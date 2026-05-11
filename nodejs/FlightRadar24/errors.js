/** Base class for all FlightRadar24 errors. */
class FlightRadarError extends Error {
    /** @param {string} message */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/** Thrown when an airport cannot be found. */
class AirportNotFoundError extends FlightRadarError {}

/** Thrown when a Cloudflare-level error is returned. */
class CloudflareError extends FlightRadarError {
    /**
     * @param {string} message
     * @param {object} response
     */
    constructor(message, response) {
        super(message);
        this.response = response;
    }
}

/** Thrown when login fails or an authenticated endpoint is accessed without login. */
class LoginError extends FlightRadarError {}

module.exports = {FlightRadarError, AirportNotFoundError, CloudflareError, LoginError};
