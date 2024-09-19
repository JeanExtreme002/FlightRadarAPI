/**
 * Unofficial SDK for FlightRadar24.
 *
 * This SDK provides flight and airport data available to the public
 * on the FlightRadar24 website. 
 *
 * See more information at:
 * https://www.flightradar24.com/premium/
 * https://www.flightradar24.com/terms-and-conditions
 */

const {AirportNotFoundError, CloudflareError, LoginError} = require("./errors");
const FlightRadar24API = require("./api");
const FlightTrackerConfig = require("./flightTrackerConfig");
const Airport = require("./entities/airport");
const Entity = require("./entities/entity");
const Flight = require("./entities/flight");

const author = "Jean Loui Bernard Silva de Jesus";
const version = "1.3.33";

module.exports = {
    FlightRadar24API,
    FlightTrackerConfig,
    Airport, Entity, Flight,
    AirportNotFoundError, CloudflareError, LoginError,
    author, version,
};
