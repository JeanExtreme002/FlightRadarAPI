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


/**
 * Class to make requests to the FlightRadar24.
 */
class APIRequest {
    /**
     * Constructor of the APIRequest class.
     *
     * @param {string} [url]
     * @param {object} [params]
     * @param {object} [headers]
     * @param {object} [data]
     * @param {object} [cookies]
     * @param {object} [excludeStatusCodes=[]]
     */
    constructor(url, params = null, headers = null, data = null, cookies = null, excludeStatusCodes = []) {
        this.requestParams = {
            "params": params,
            "headers": headers,
            "data": data,
            "cookies": cookies,
        };

        this.requestMethod = data == null ? "GET" : "POST";
        this.__excludeStatusCodes = excludeStatusCodes;

        if (params != null && Object.keys(params).length > 0) {
            url += "?";

            for (const key in params) {
                if (Object.prototype.hasOwnProperty.call(params, key)) { // guard-for-in
                    url += key + "=" + params[key] + "&";
                }
            }
            url = url.slice(0, -1);
        }

        this.url = url;

        this.__response = {};
        this.__content = null;
    }

    /**
     * Send the request and receive a response.
     *
     * @return {this}
     */
    async receive() {
        const settings = {
            method: this.requestMethod,
            headers: this.requestParams["headers"],
            dispatcher: chromeAgent,
        };

        if (settings["method"] == "POST") {
            const formData = new URLSearchParams();

            Object.entries(this.requestParams["data"]).forEach(([key, value]) => {
                formData.append(key, value);
            });

            settings["body"] = formData;
        }

        this.__response = await fetch(this.url, settings);

        if (this.getStatusCode() == 520) {
            throw new CloudflareError(
                "An unexpected error has occurred. Perhaps you are making too many calls?",
                this.__response,
            );
        }

        if (!this.__excludeStatusCodes.includes(this.getStatusCode())) {
            if (![200, 201, 202].includes(this.getStatusCode())) {
                throw new Error(
                    "Received status code '" +
                    this.getStatusCode() + ": " +
                    this.__response.statusText + "' for the URL " +
                    this.url,
                );
            }
        }
        return this;
    }

    /**
     * Return the received content from the request.
     */
    async getContent() {
        if (this.__content !== null) {
            return this.__content;
        }

        let contentType = this.getHeaders()["content-type"];
        contentType = contentType == null ? "" : contentType;

        if (contentType.includes("application/json")) {
            this.__content = await this.__response.json();
        }
        else if (contentType.includes("text")) {
            this.__content = await this.__response.text();
        }
        else {
            this.__content = await this.__response.arrayBuffer();
        }
        return this.__content;
    }

    /**
     * Return the received cookies from the request.
     */
    getCookies() {
        const rawCookies = this.__response.headers.getSetCookie();
        const cookies = {};

        if (rawCookies == null || rawCookies.length === 0) {
            return {};
        }

        rawCookies.forEach((string) => {
            const keyAndValue = string.split(";")[0].split("=");
            cookies[keyAndValue[0]] = keyAndValue[1];
        });

        return cookies;
    }

    /**
     * Return the headers of the response.
     */
    getHeaders() {
        const headersAsDict = {};

        this.__response.headers.forEach((value, key) => {
            headersAsDict[key] = value;
        });
        return headersAsDict;
    }

    /**
     * Return the received response object.
     */
    getResponseObject() {
        return this.__response;
    }

    /**
     * Return the status code of the response.
     */
    getStatusCode() {
        return this.__response.status;
    }
}

module.exports = APIRequest;
