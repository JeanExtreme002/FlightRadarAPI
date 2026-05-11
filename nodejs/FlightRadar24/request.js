const {CloudflareError} = require("./errors");
const {fetch, Agent} = require("undici");

// Chrome 136 TLS cipher suites to approximate its JA3 fingerprint
const CHROME_CIPHERS = [
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
].join(":");

const chromeAgent = new Agent({
    allowH2: true,
    connect: {
        ciphers: CHROME_CIPHERS,
        honorCipherOrder: false,
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        ecdhCurve: "X25519:P-256:P-384:P-521",
        sigalgs: [
            "ecdsa_secp256r1_sha256",
            "rsa_pss_rsae_sha256",
            "rsa_pkcs1_sha256",
            "ecdsa_secp384r1_sha384",
            "rsa_pss_rsae_sha384",
            "rsa_pkcs1_sha384",
            "rsa_pss_rsae_sha512",
            "rsa_pkcs1_sha512",
        ].join(":"),
    },
});

const DEFAULT_TIMEOUT_MS = 30_000;

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
} = {}) {
    if (params !== null && Object.keys(params).length > 0) {
        url += "?" + new URLSearchParams(params).toString();
    }

    const requestHeaders = Object.assign({}, headers);

    if (cookies !== null && Object.keys(cookies).length > 0) {
        requestHeaders["Cookie"] = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    }

    const method = data === null ? "GET" : "POST";
    const settings = {method, headers: requestHeaders, dispatcher: chromeAgent};

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
            throw new Error(`Request timed out after ${timeout}ms for URL ${url}`);
        }
        throw err;
    }
    finally {
        clearTimeout(timer);
    }
    const statusCode = response.status;

    if (statusCode === 520) {
        throw new CloudflareError(
            "An unexpected error has occurred. Perhaps you are making too many calls?",
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

    return {content, statusCode, cookies: responseCookies};
}

module.exports = {request};
