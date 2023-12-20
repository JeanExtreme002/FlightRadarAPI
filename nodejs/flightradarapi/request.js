const {CloudflareError} = require("./errors");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));


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
    constructor(url, params=null, headers=null, data=null, cookies=null, exclude_status_codes=[]) {
        
        this.request_params = {
            "params": params,
            "headers": headers,
            "data": data,
            "cookies": cookies
        }
        
        this.request_method = data == null ? "GET" : "POST";
        this.__exclude_status_codes = exclude_status_codes;

        if (params != null && Object.keys(params).length > 0) {
            url += "?";

            for (let key in params) {
                url += key + "=" + params[key] + "&";
            }
            url = url.slice(0, -1);
        }

        this.url = url;

        this.__response = {};
        this.__content = null;
    }

    /**
     * Send the request and receive a response.
     */
    async receive() {
        const settings = {
            method: this.request_method,
            headers: this.request_params["headers"],
            cookies: this.request_params["cookies"]
        };

        if (settings["method"] == "POST") {
            settings["body"] = JSON.stringify(this.request_params["data"]);
        }

        this.__response = await fetch(this.url, settings);

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
        const content = await this.__response.text();
        this.__content = content;

        let content_type = this.get_headers()["content-type"];
        content_type = content_type == null ? "" : content_type;

        // Return a dictionary if the content type is JSON.
        if (content_type.includes("application/json")) {
            this.__content = JSON.parse(content);
        }
        return this.__content;
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
        const headers_as_dict = {};

        this.__response.headers.forEach((value, key) => {
            headers_as_dict[key] = value;
        });
        return headers_as_dict;
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
    get_status_code() {
        return this.__response.status;
    }
}

module.exports = APIRequest;