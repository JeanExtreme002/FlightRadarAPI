/**
 * Unofficial SDK for FlightRadar24.
 *
 * This SDK provides flight and airport data available to the public
 * on the FlightRadar24 website. If you want to use the data collected
 * using this API commercially, you need to subscribe to the Business plan.

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
const version = "1.3.28";

module.exports = {
    FlightRadar24API,
    FlightTrackerConfig,
    Airport, Entity, Flight,
    AirportNotFoundError, CloudflareError, LoginError,
    author, version,
};
