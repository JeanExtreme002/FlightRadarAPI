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

const {FlightRadarError, AirportNotFoundError, CloudflareError, LoginError} = require("./errors");
const FlightRadar24API = require("./api");
const FlightTrackerConfig = require("./flightTrackerConfig");
const Airport = require("./entities/airport");
const Entity = require("./entities/entity");
const Flight = require("./entities/flight");
const {Countries} = require("./core");

const {version, author} = require("../package.json");

module.exports = {
    FlightRadar24API,
    FlightTrackerConfig,
    Countries,
    Airport, Entity, Flight,
    FlightRadarError, AirportNotFoundError, CloudflareError, LoginError,
    author, version,
};
