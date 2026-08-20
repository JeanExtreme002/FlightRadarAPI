const { CloudflareError, DecompressionLimitError } = require("./errors");
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

// A compressed body is trusted only as far as its expanded size: brotli reaches
// ratios high enough to exhaust memory from a few kilobytes on the wire. undici
// decompresses in the transport, so the budget lands on the decoded body.
// FR24's largest payload (the airports feed) is orders of magnitude under this.
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;

/**
 * Decode a body as UTF-8 text, dropping a leading byte-order mark.
 *
 * `Response.text()` ran the spec's UTF-8 decode, which strips the BOM;
 * `Buffer.toString` does not, and a BOM left in place breaks `JSON.parse`.
 *
 * @param {Buffer} body
 * @return {string}
 */
function decodeText(body) {
    const text = body.toString("utf-8");
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

/**
 * Read a response body, refusing one that grows past `limit`.
 *
 * Streamed rather than buffered whole so the cap bounds the work: reading
 * stops and the socket is released at the first chunk over budget, instead of
 * discovering the size after paying for it.
 *
 * @param {Response} response
 * @param {number} limit - maximum bytes to accept
 * @param {string} url - for the error message
 * @return {Promise<Buffer>}
 */
async function readBoundedBody(response, limit, url) {
    if (response.body === null) return Buffer.alloc(0);

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;

    for (;;) {
        const { done, value } = await reader.read();

        if (done) break;

        total += value.byteLength;

        if (total > limit) {
            await reader.cancel();
            throw new DecompressionLimitError(
                `Response body from ${url} exceeds the ${limit} byte limit.`,
            );
        }
        chunks.push(value);
    }

    return Buffer.concat(chunks);
}

/**
 * Parse one `Set-Cookie` header into a cookie record.
 *
 * The name/value pair is split on the FIRST `=` only: session tokens are
 * routinely base64 and end in `=` padding, which a greedy split truncates.
 *
 * Not delegated to undici's `getSetCookies`: it drops a negative `Max-Age`
 * instead of treating it as a deletion, accepts an empty cookie name, and
 * widens a relative `Path` to `/`. See the parser tests.
 *
 * @param {string} header - a single Set-Cookie value
 * @param {URL} url - the URL the header arrived from, for the default scope
 * @return {object|null} `{name, value, domain, path, secure, hostOnly, expires}`, or null if unparsable
 */
function parseSetCookie(header, url) {
    const [pair, ...attributeParts] = String(header).split(";");
    const separator = pair.indexOf("=");

    if (separator < 1) return null;

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();

    if (!name) return null;

    const cookie = {
        name,
        value,
        domain: url.hostname,
        path: defaultPath(url.pathname),
        secure: false,
        hostOnly: true,
        expires: null,
        storedAt: 0,
    };

    for (const part of attributeParts) {
        const index = part.indexOf("=");
        const key = (index < 0 ? part : part.slice(0, index)).trim().toLowerCase();
        const attributeValue = index < 0 ? "" : part.slice(index + 1).trim();

        if (key === "secure") cookie.secure = true;
        else if (key === "path" && attributeValue.startsWith("/")) cookie.path = attributeValue;
        else if (key === "expires" && cookie.expires === null) {
            const parsed = Date.parse(attributeValue);
            if (!Number.isNaN(parsed)) cookie.expires = parsed;
        }
        else if (key === "max-age" && /^-?\d+$/.test(attributeValue)) {
            // Max-Age wins over Expires, and <= 0 means "delete now". A malformed
            // value must be ignored, not read as 0 — that would delete the cookie.
            cookie.expires = Date.now() + Number(attributeValue) * 1000;
        }
        else if (key === "domain" && attributeValue) {
            const domain = attributeValue.replace(/^\./, "").toLowerCase();
            // A dotless domain is a TLD: `Domain=com` would scope the cookie to
            // every .com host the caller later requests.
            if (domain.includes(".") && domainMatches(url.hostname, domain)) {
                cookie.domain = domain;
                cookie.hostOnly = false;
            }
        }
    }

    return cookie;
}

/**
 * RFC 6265 default-path: the request path up to, but not including, the rightmost `/`.
 *
 * @param {string} pathname
 * @return {string}
 */
function defaultPath(pathname) {
    if (!pathname.startsWith("/")) return "/";
    const lastSlash = pathname.lastIndexOf("/");
    return lastSlash < 1 ? "/" : pathname.slice(0, lastSlash);
}

/**
 * @param {string} host - request hostname
 * @param {string} domain - cookie domain, without a leading dot
 * @return {boolean} whether the cookie's domain covers this host
 */
function domainMatches(host, domain) {
    return host === domain || host.endsWith("." + domain);
}

/**
 * @param {string} requestPath
 * @param {string} cookiePath
 * @return {boolean}
 */
function pathMatches(requestPath, cookiePath) {
    if (requestPath === cookiePath) return true;
    if (!requestPath.startsWith(cookiePath)) return false;
    return cookiePath.endsWith("/") || requestPath[cookiePath.length] === "/";
}

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
 * @param {number} [options.maxResponseBytes] - Maximum accepted response body size
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
    maxResponseBytes = MAX_RESPONSE_BYTES,
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
    let body;

    try {
        response = await fetch(url, settings);

        // Read before the status checks below, for two reasons: an abandoned
        // body leaves undici no choice but to destroy the connection, so every
        // error response would cost a fresh TLS handshake; and a Cloudflare
        // challenge page is the one thing worth having when a block happens.
        // Inside the try so the timeout still covers the read — the abort
        // signal is what stops a trickled body holding the call open.
        //
        // The cost is that an error response is read before it is raised, so a
        // large one is paid for in full (bounded by the budget), and a body
        // over budget surfaces as DecompressionLimitError rather than as the
        // status or Cloudflare error behind it.
        body = await readBoundedBody(response, maxResponseBytes, url);
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
            body.toString("utf-8"),
        );
    }

    if (!allowedErrorCodes.includes(statusCode) && (statusCode < 200 || statusCode >= 300)) {
        throw new Error(`Received status code '${statusCode}: ${response.statusText}' for the URL ${url}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    let content;

    if (contentType.includes("application/json")) {
        content = JSON.parse(decodeText(body));
    }
    else if (contentType.includes("text")) {
        content = decodeText(body);
    }
    else {
        content = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    }

    const rawCookies = response.headers.getSetCookie() ?? [];
    // Null-prototype: a cookie named `toString` must read as absent, not as an
    // inherited function, and one named `__proto__` must not vanish.
    const responseCookies = Object.create(null);

    for (const header of rawCookies) {
        const pair = String(header).split(";")[0];
        const separator = pair.indexOf("=");

        // Split on the first `=` only, so base64 padding survives.
        if (separator > 0) responseCookies[pair.slice(0, separator).trim()] = pair.slice(separator + 1).trim();
    }

    // `response.url` is the URL after redirects — the host that actually set the cookies.
    return { content, statusCode, cookies: responseCookies, rawCookies, url: response.url || url };
}

/**
 * HTTP session that automatically manages cookies across requests.
 *
 * The jar honours the scope FR24 sets on each cookie: a cookie stored by
 * `www.flightradar24.com` is not replayed to `cdn.`/`api.`/`data-live.`, and
 * `Path`, `Secure` and expiry are respected. A Map keyed by name/domain/path
 * keeps same-named cookies from different hosts apart, and keeps a cookie
 * called `__proto__` from reaching Object.prototype.
 */
class Session {
    /**
     * @param {object} [options]
     * @param {object} [options.dispatcher] - undici Agent to use for every request.
     */
    constructor({ dispatcher = null } = {}) {
        this.__jar = new Map();
        this.__sequence = 0;
        this.__dispatcher = dispatcher;
    }

    /**
     * Return the value of a stored cookie by name, ignoring scope.
     *
     * @param {string} name
     * @return {string|undefined}
     */
    getCookie(name) {
        let match = null;

        for (const cookie of this.__jar.values()) {
            if (cookie.name !== name || this.__isExpired(cookie)) continue;
            // The same name can live under several scopes at once. Take the
            // newest: a re-issued token supersedes the one it replaces, even
            // when the old one sat at a more specific path.
            if (match === null || cookie.storedAt > match.storedAt) match = cookie;
        }

        return match === null ? undefined : match.value;
    }

    /**
     * Clear all stored cookies.
     */
    clearCookies() {
        this.__jar.clear();
    }

    /**
     * Drop every stored cookie with this name, leaving the rest of the jar intact.
     *
     * Sheds load-balancer stickiness without discarding the login session,
     * which lives in the same jar.
     *
     * @param {string} name
     */
    deleteCookie(name) {
        for (const [key, cookie] of this.__jar) {
            if (cookie.name === name) this.__jar.delete(key);
        }
    }

    /**
     * @param {object} cookie
     * @return {boolean}
     */
    __isExpired(cookie) {
        return cookie.expires !== null && cookie.expires <= Date.now();
    }

    /**
     * Store the `Set-Cookie` headers a response arrived with.
     *
     * @param {string} url - the URL that produced the response
     * @param {Array<string>} rawCookies
     */
    __storeCookies(url, rawCookies) {
        const target = new URL(url);

        for (const header of rawCookies ?? []) {
            const cookie = parseSetCookie(header, target);

            if (cookie === null) continue;
            if (cookie.secure && target.protocol !== "https:") continue;

            const key = `${cookie.name};${cookie.domain};${cookie.path}`;

            cookie.storedAt = ++this.__sequence;

            // An expiry in the past is a deletion instruction, not a value.
            if (this.__isExpired(cookie)) this.__jar.delete(key);
            else this.__jar.set(key, cookie);
        }
    }

    /**
     * Select the stored cookies that are in scope for a URL.
     *
     * @param {string} url
     * @return {object} name/value pairs to send
     */
    __cookiesFor(url) {
        const target = new URL(url);
        const isSecure = target.protocol === "https:";
        const matches = [];

        for (const [key, cookie] of this.__jar) {
            if (this.__isExpired(cookie)) {
                this.__jar.delete(key);
                continue;
            }
            if (cookie.secure && !isSecure) continue;
            if (!pathMatches(target.pathname, cookie.path)) continue;

            const hostInScope = cookie.hostOnly ?
                target.hostname === cookie.domain :
                domainMatches(target.hostname, cookie.domain);

            if (hostInScope) matches.push(cookie);
        }

        // Oldest first, so the newest of a same-named pair wins — the rule
        // getCookie() uses, because a re-issued token supersedes the one it
        // replaces. `storedAt` is unique per cookie, so no tie is possible.
        // Collapsing to one is a deliberate limit of building the header from
        // a flat map; RFC 6265 would send both, most-specific path first.
        matches.sort((a, b) => a.storedAt - b.storedAt);

        const selected = Object.create(null);

        for (const cookie of matches) selected[cookie.name] = cookie.value;

        return selected;
    }

    /**
     * Make an HTTP request, automatically sending the cookies that are in
     * scope for the URL and storing any cookies the response returns.
     *
     * Accepts the same parameters as the module-level {@link request} function.
     *
     * @param {string} url
     * @param {object} [options={}]
     * @return {Promise<{content: *, statusCode: number, cookies: object}>}
     */
    async request(url, options = {}) {
        const { cookies: extraCookies, ...rest } = options;
        // Null-prototype like the maps it merges, so an inherited `toString`
        // cannot reappear on the way into the Cookie header.
        const merged = Object.assign(Object.create(null), this.__cookiesFor(url), extraCookies ?? {});
        const cookies = Object.keys(merged).length > 0 ? merged : null;

        const result = await request(url, {
            dispatcher: this.__dispatcher,
            ...rest,
            cookies,
        });

        this.__storeCookies(result.url || url, result.rawCookies);

        return result;
    }
}

/**
 * Central HTTP client for the FlightRadarAPI package.
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
        this.__dispatcher = impersonate ? buildImpersonateAgent(impersonate) : defaultAgent;
        this.__session = new Session({ dispatcher: this.__dispatcher });
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
     * Make a stateless request that does not touch the shared cookie jar.
     *
     * Safe to call from concurrent fan-outs, where per-response `Set-Cookie`
     * headers would otherwise race onto the shared jar. The TLS dispatcher is
     * still reused so the impersonation profile stays consistent with the session.
     *
     * @param {string} url
     * @param {object} [options={}]
     * @return {Promise<{content: *, statusCode: number, cookies: object}>}
     */
    async requestStandalone(url, options = {}) {
        return runWithRetry(
            () => request(url, { dispatcher: this.__dispatcher, ...options }),
            this.__retry,
        );
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

    /**
     * Drop a single cookie from the session, leaving the rest of the jar intact.
     *
     * @param {string} name
     */
    deleteCookie(name) {
        this.__session.deleteCookie(name);
    }
}

module.exports = {
    request, Session, APIClient, RetryPolicy, buildImpersonateAgent, CHROME136_PROFILE,
    MAX_RESPONSE_BYTES,
};
