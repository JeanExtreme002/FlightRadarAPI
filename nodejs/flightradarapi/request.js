import fetch from "node-fetch";

const {CloudflareError} = require("./errors");
const brotli = require("brotli");
const {ungzip} = require("node-gzip");


class APIRequest {
    /**
     * Class to make requests to the FlightRadar24.
     */

    /**
     * Constructor of the APIRequest class.
     * 
     * @param {string} url
     * @param {object} params
     * @param {object} headers
     * @param {object} data
     * @param {object} cookies
     * @param {object} exclude_status_codes
     */
    constructor(url, params, headers, data, cookies, exclude_status_codes) {

        this.request_params = {
            "params": params,
            "headers": headers,
            "data": data,
            "cookies": cookies
        }

        this.__exclude_status_codes = exclude_status_codes;

        this.request_method = data == null ? "get" : "post";

        if (params != null && Object.keys(params).length > 0) {
            url += "?";

            for (let key in params) {
                url += key + "=" + params[key] + "&";
            }
            url = url.slice(0, -1);
        }

        this.url = url;

        this.__response = {};
    }

    /**
     * Send the request.
     */
    async request() {
        this.__response = await fetch(this.url, {
            method: this.request_method,
            body: JSON.stringify(this.request_params["data"]),
            headers: this.request_params["headers"],
            cookies: this.request_params["cookies"]
        });

        const data = await response.json();

        if (this.get_status_code() == 520) {
            throw new CloudflareError(
                message = "An unexpected error has occurred. Perhaps you are making too many calls?",
                response = this.__response
            );
        }

        if (this.__exclude_status_codes.includes(this.get_status_code())) {
            this.__response.raise_for_status();
        }
        return this;
    }

    /**
     * Return the received content from the request.
     */
    async get_content() {
        content = this.__response.content

        content_encoding = this.__response.headers["Content-Encoding"];
        content_encoding = content_encoding == null ? "" : content_encoding;

        content_type = this.__response.headers["Content-Type"];

        // Try to decode the content.
        try {
            if (content_encoding === "gzip") {
                content = await ungzip(content);
            }
            else if (content_encoding === "br") {
                content = brotli.decompress(content);
            }
        } catch(error) {
            // Go ahead.
        }

        // Return a dictionary if the content type is JSON.
        if (content_type.includes("application/json")) {
            return json.loads(content);
        }
        return content;
    }

    /**
     * Return the received cookies from the request.
     */
    get_cookies() {
        return this.__response.headers.getSetCookie;
    }

    /**
     * Return the headers of the response.
     */
    get_headers() {
        return this.__response.headers;
    }

    /**
     * Return the received response object.
     */
    get_response_object() {
        return this.__response;
    }

    /**
     * Return the status code of the response.
     */
    get_status_code(self) {
        return this.__response.status;
    }
}