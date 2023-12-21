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

const {FlightRadar24API, FlightTrackerConfig} = require("./api");
const Airport = require("./entities/airport");
const Entity = require("./entities/entity");
const Flight = require("./entities/flight");

const author = "Jean Loui Bernard Silva de Jesus"
const version = "1.3.14"

module.exports = {
    FlightRadar24API: FlightRadar24API, 
    FlightTrackerConfig: FlightTrackerConfig,
    Airport: Airport, Entity: Entity, Flight: Flight,
    author: author, version: version
};