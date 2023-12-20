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
const Flight = require("./entities/flight");

const author = "Jean Loui Bernard Silva de Jesus"
const version = "1.3.13"

module.exports = {
    FlightRadar24API: FlightRadar24API, 
    FlightTrackerConfig: FlightTrackerConfig,
    Airport: Airport, Flight: Flight,
    author: author, version: version
};

f = new FlightRadar24API();
f.set_flight_tracker_config(null, {limit:10});

// Below, errors for fixing
// f.login(...).then((resp) => console.log(resp));