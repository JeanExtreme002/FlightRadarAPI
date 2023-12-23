class AirportNotFoundError extends Error {
    constructor(message) {
        super(message);

        this.name = this.constructor.name;

        Error.captureStackTrace(this, this.constructor);
    }
}

class CloudflareError extends Error {
    constructor(message, response) {
        super(message);

        this.name = this.constructor.name;
        this.response = response;

        Error.captureStackTrace(this, this.constructor);
    }
}

class LoginError extends Error {
    constructor(message) {
        super(message);

        this.name = this.constructor.name;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = {AirportNotFoundError, CloudflareError, LoginError};
