const { CloudflareError } = require("./errors");
const { fetch, Agent } = require("undici");

/** Thrown when a request exceeds its timeout. Surfaced as a distinct class
 * so the retry layer can identify it after `fetch`'s native AbortError is
 * translated into a user-friendly message. */
class TimeoutError extends Error {
    /** @param {string} message */
    constructor(message) {
        super(message);
        this.name = "TimeoutError";
    }
}

// Chrome 136 TLS cipher suites to approximate its JA3 fingerprint.
// When FR24 updates its Cloudflare bot mitigation, override via
// `new FlightRadar24API({ impersonate: { ciphers: [...], sigalgs: [...] } })`.
//
// Deep-frozen because this constant is exported. A shallow `Object.freeze`
// would leave the nested arrays writable, letting any consumer push values
// into them and silently pollute every future request the SDK makes.
const CHROME136_PROFILE = Object.freeze({
    ciphers: Object.freeze([
        "TLS_AES_128_GCM_SHA256",
        "TLS_AES_256_GCM_SHA384",
        "TLS_CHACHA20_POLY1305_SHA256",
        "ECDHE-ECDSA-AES128-GCM-SHA256",
        "ECDHE-RSA-AES128-GCM-SHA256",
        "ECDHE-ECDSA-AES256-GCM-SHA384",
        "ECDHE-RSA-AES256-GCM-SHA384",
        "ECDHE-ECDSA-CHACHA20-POLY1305",
        "ECDHE-RSA-CHACHA20-POLY1305",
        "ECDHE-RSA-AES128-SHA",
        "ECDHE-RSA-AES256-SHA",
        "AES128-GCM-SHA256",
        "AES256-GCM-SHA384",
        "AES128-SHA",
        "AES256-SHA",
    ]),
    ecdhCurve: "X25519:P-256:P-384:P-521",
    sigalgs: Object.freeze([
        "ecdsa_secp256r1_sha256",
        "rsa_pss_rsae_sha256",
        "rsa_pkcs1_sha256",
        "ecdsa_secp384r1_sha384",
        "rsa_pss_rsae_sha384",
        "rsa_pkcs1_sha384",
        "rsa_pss_rsae_sha512",
        "rsa_pkcs1_sha512",
    ]),
});

/**
 * Build an undici Agent that impersonates a browser's TLS handshake.
 *
 * @param {object} [profile=CHROME136_PROFILE] - Partial override of `{ciphers, sigalgs, ecdhCurve}`.
 * @return {Agent}
 */
function buildImpersonateAgent(profile = CHROME136_PROFILE) {
    const merged = { ...CHROME136_PROFILE, ...profile };
    return new Agent({
        allowH2: true,
        connect: {
            ciphers: merged.ciphers.join(":"),
            honorCipherOrder: false,
            minVersion: "TLSv1.2",
            maxVersion: "TLSv1.3",
            ecdhCurve: merged.ecdhCurve,
            sigalgs: merged.sigalgs.join(":"),
        },
    });
}

const defaultAgent = buildImpersonateAgent();

/**
 * Retry policy for transient errors (CloudflareError + AbortError / network errors).
 *
 * Pass an instance to `new FlightRadar24API({ retry: new RetryPolicy({ maxAttempts: 3 }) })`
 * to wrap every HTTP call in an exponential-backoff loop.
 */
class RetryPolicy {
    /**
     * @param {object} [options]
     * @param {number} [options.maxAttempts=1] - total attempts including the first.
     * @param {number} [options.baseDelayMs=1000] - first backoff sleep in ms.
     * @param {number} [options.maxDelayMs=30000] - cap for the exponential backoff.
     * @param {number} [options.jitterMs=500] - random ms added to each sleep.
     */
    constructor({ maxAttempts = 1, baseDelayMs = 1000, maxDelayMs = 30_000, jitterMs = 500 } = {}) {
        if (maxAttempts < 1) throw new Error("maxAttempts must be >= 1");
        if (baseDelayMs < 0 || maxDelayMs < 0 || jitterMs < 0) {
            throw new Error("baseDelayMs, maxDelayMs and jitterMs must all be >= 0");
        }
        this.maxAttempts = maxAttempts;
        this.baseDelayMs = baseDelayMs;
        this.maxDelayMs = maxDelayMs;
        this.jitterMs = jitterMs;
    }

    /**
     * @param {number} attemptIndex - zero-based attempt index
     * @return {number} ms to sleep before the next attempt
     */
    sleepFor(attemptIndex) {
        const delay = Math.min(this.baseDelayMs * (2 ** attemptIndex), this.maxDelayMs);
        return delay + Math.random() * this.jitterMs;
    }
}

/**
 * @param {Function} fn - async thunk producing the request promise
 * @param {RetryPolicy|null} retry
 * @return {Promise<*>}
 */
async function runWithRetry(fn, retry) {
    if (!retry || retry.maxAttempts <= 1) return fn();

    let lastError;
    for (let attempt = 0; attempt < retry.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            const isCloudflare = err instanceof CloudflareError;
            const isTransient = err instanceof TimeoutError ||
                err.name === "AbortError" ||
                (err.cause && (err.cause.code === "UND_ERR_SOCKET" || err.cause.code === "ECONNRESET"));
            if (!isCloudflare && !isTransient) throw err;
            lastError = err;
        }
        if (attempt < retry.maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, retry.sleepFor(attempt)));
        }
    }
    throw lastError;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Detect Cloudflare-level blocks.
 *
 * FR24 fronts the public site with Cloudflare, so a `Server: cloudflare`
 * header is present on *every* response — including legitimate 403s from
 * the FR24 origin (e.g. premium-only endpoints accessed by a free account).
 * To avoid false positives we rely on signals that Cloudflare sets only
 * when its own bot-management / challenge actually took action:
 *
 * - HTTP 520 (Cloudflare's "unknown error from origin").
 * - HTTP 403 with the `cf-mitigated` header set — Cloudflare adds this
 *   specifically when it (not the origin) decided to block the request.
 *
 * @param {number} statusCode
 * @param {Headers} headers
 * @return {boolean}
 */
function isCloudflareBlock(statusCode, headers) {
    if (statusCode === 520) return true;
    if (statusCode !== 403) return false;
    return Boolean(headers.get("cf-mitigated"));
}

/**
 * Make an HTTP request to the FlightRadar24 API.
 *
 * @param {string} url
 * @param {object} [options={}]
 * @param {object} [options.params] - Query string parameters appended to the URL
 * @param {object} [options.headers] - Request headers
 * @param {object} [options.data] - POST body fields (presence triggers POST method)
 * @param {object} [options.cookies] - Cookies to include in the request
 * @param {Array<number>} [options.allowedErrorCodes=[]] - Status codes that should not throw
 * @param {number} [options.timeout=30000] - Request timeout in milliseconds
 * @return {Promise<{content: *, statusCode: number, cookies: object}>}
 */
async function request(url, {
    params = null,
    headers = null,
    data = null,
    cookies = null,
    allowedErrorCodes = [],
    timeout = DEFAULT_TIMEOUT_MS,
    dispatcher = null,
} = {}) {
    if (params !== null && Object.keys(params).length > 0) {
        url += "?" + new URLSearchParams(params).toString();
    }

    const requestHeaders = Object.assign({}, headers);

    if (cookies !== null && Object.keys(cookies).length > 0) {
        requestHeaders["Cookie"] = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    }

    const method = data === null ? "GET" : "POST";
    const settings = { method, headers: requestHeaders, dispatcher: dispatcher ?? defaultAgent };

    if (method === "POST") {
        const formData = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => formData.append(key, value));
        settings.body = formData;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    settings.signal = controller.signal;

    let response;
    try {
        response = await fetch(url, settings);
    }
    catch (err) {
        if (err.name === "AbortError") {
            throw new TimeoutError(`Request timed out after ${timeout}ms for URL ${url}`);
        }
        throw err;
    }
    finally {
        clearTimeout(timer);
    }
    const statusCode = response.status;

    // Cloudflare detection only when the caller did not opt-in to this status code.
    // `getAirlineLogo`/`getCountryFlag` allow 403 to mean "asset not found" on the CDN.
    if (!allowedErrorCodes.includes(statusCode) && isCloudflareBlock(statusCode, response.headers)) {
        throw new CloudflareError(
            "Blocked by Cloudflare. Perhaps you are making too many calls, " +
            "or the TLS impersonation needs to be updated.",
            response,
        );
    }

    if (!allowedErrorCodes.includes(statusCode) && (statusCode < 200 || statusCode >= 300)) {
        throw new Error(`Received status code '${statusCode}: ${response.statusText}' for the URL ${url}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    let content;

    if (contentType.includes("application/json")) {
        content = await response.json();
    }
    else if (contentType.includes("text")) {
        content = await response.text();
    }
    else {
        content = await response.arrayBuffer();
    }

    const rawCookies = response.headers.getSetCookie();
    const responseCookies = {};

    if (rawCookies?.length > 0) {
        rawCookies.forEach((string) => {
            const keyAndValue = string.split(";")[0].split("=");
            responseCookies[keyAndValue[0]] = keyAndValue[1];
        });
    }

    return { content, statusCode, cookies: responseCookies };
}

/**
 * HTTP session that automatically manages cookies across requests.
 */
class Session {
    /**
     * @param {object} [options]
     * @param {object} [options.dispatcher] - undici Agent to use for every request.
     */
    constructor({ dispatcher = null } = {}) {
        this.__cookies = {};
        this.__dispatcher = dispatcher;
    }

    /**
     * Return the value of a stored cookie by name.
     *
     * @param {string} name
     * @return {string|undefined}
     */
    getCookie(name) {
        return this.__cookies[name];
    }

    /**
     * Clear all stored cookies.
     */
    clearCookies() {
        this.__cookies = {};
    }

    /**
     * Make an HTTP request, automatically sending stored cookies and storing
     * any cookies returned by the response.
     *
     * Accepts the same parameters as the module-level {@link request} function.
     *
     * @param {string} url
     * @param {object} [options={}]
     * @return {Promise<{content: *, statusCode: number, cookies: object}>}
     */
    async request(url, options = {}) {
        const { cookies: extraCookies, ...rest } = options;
        const merged = { ...this.__cookies, ...(extraCookies ?? {}) };
        const cookies = Object.keys(merged).length > 0 ? merged : null;

        const result = await request(url, {
            dispatcher: this.__dispatcher,
            ...rest,
            cookies,
        });

        if (result.cookies && Object.keys(result.cookies).length > 0) {
            Object.assign(this.__cookies, result.cookies);
        }

        return result;
    }
}

/**
 * Central HTTP client for the FlightRadar24 package.
 *
 * Owns the persistent session (cookie jar, TLS fingerprint, future bypass logic)
 * so that the rest of the codebase never has to deal with those concerns directly.
 */
class APIClient {
    /**
     * @param {object} [options]
     * @param {object} [options.impersonate] - Optional TLS profile override
     *     (`{ciphers, sigalgs, ecdhCurve}`). Falls back to the bundled Chrome 136 profile.
     */
    constructor({ impersonate = null, retry = null } = {}) {
        const dispatcher = impersonate ? buildImpersonateAgent(impersonate) : defaultAgent;
        this.__session = new Session({ dispatcher });
        this.__retry = retry;
    }

    /**
     * Make a request through the shared session.
     *
     * @param {string} url
     * @param {object} [options={}]
     * @return {Promise<{content: *, statusCode: number, cookies: object}>}
     */
    async request(url, options = {}) {
        return runWithRetry(() => this.__session.request(url, options), this.__retry);
    }

    /**
     * Return the value of a stored cookie by name.
     *
     * @param {string} name
     * @return {string|undefined}
     */
    getCookie(name) {
        return this.__session.getCookie(name);
    }

    /**
     * Clear all cookies from the session.
     */
    clearCookies() {
        this.__session.clearCookies();
    }
}

module.exports = { request, Session, APIClient, RetryPolicy, buildImpersonateAgent, CHROME136_PROFILE };
