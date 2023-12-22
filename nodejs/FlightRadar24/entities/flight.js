const Entity = require("./entity");


class Flight extends Entity {
    /**
     * Flight representation.
     */

    static __defaultText = "N/A";

    /**
     * Constructor of Flight class.
     *
     * @param {*} flightId - The flight ID specifically used by FlightRadar24
     * @param {*} info - Dictionary with received data from FlightRadar24
     */
    constructor(flightId, info) {
        super();

        this.__setPosition(this.__getInfo(info[1]), this.__getInfo(info[2]));

        this.id = flightId;
        this.icao24bit = this.__getInfo(info[0]);
        this.heading = this.__getInfo(info[3]);
        this.altitude = this.__getInfo(info[4]);
        this.groundSpeed = this.__getInfo(info[5]);
        this.squawk = this.__getInfo(info[6]);
        this.aircraftCode = this.__getInfo(info[8]);
        this.registration = this.__getInfo(info[9]);
        this.time = this.__getInfo(info[10]);
        this.originAirportIata = this.__getInfo(info[11]);
        this.destinationAirportIata = this.__getInfo(info[12]);
        this.number = this.__getInfo(info[13]);
        this.airlineIata = this.__getInfo(info[13].slice(0, 2));
        this.onGround = this.__getInfo(info[14]);
        this.verticalSpeed =this.__getInfo(info[15]);
        this.callsign = this.__getInfo(info[16]);
        this.airlineIcao = this.__getInfo(info[18]);
    }

    /**
     * Check one or more flight information.
     *
     * You can use the prefix "max" or "min" in the parameter
     * to compare numeric data with ">" or "<".
     *
     * Example: checkInfo({minAltitude: 6700, maxAltitude: 13000, airlineIcao: "THY"})
     * @param {object} info
     * @return {boolean}
     */
    checkInfo(info) {
        const comparisonFunctions = {"max": Math.max, "min": Math.min};

        for (let key in info) {
            let prefix = key.slice(0, 3);
            const value = info[key];

            // Separate the comparison prefix if it exists.
            if ((prefix === "max") || (prefix === "min")) {
                key = key[3].toLowerCase() + key.slice(4, key.length)
            } else {
                prefix = null;
            }

            // Check if the value is greater than or less than the attribute value.
            if (this.hasOwnProperty(key) && prefix) {
                if (comparisonFunctions[prefix](value, this[key]) !== value) {
                    return false;
                }
            }
            // Check if the value is equal.
            else if (this.hasOwnProperty(key) && value !== this[key]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Return the formatted altitude, with the unit of measure.
     * @return {string}
     */
    getAltitude() {
        return this.altitude.toString() + " ft";
    }

    /**
     * Return the formatted flight level, with the unit of measure.
     * @return {string}
     */
    getFlightLevel() {
        if (this.altitude >= 10000) {
            return this.altitude.toString().slice(0, 3) + " FL";
        }
        return this.getAltitude();
    }

    /**
     * Return the formatted ground speed, with the unit of measure.
     * @return {string}
     */
    getGroundSpeed() {
        const sufix = this.groundSpeed > 1 ? "s" : "";
        return this.groundSpeed.toString() + " kt" + sufix;
    }

    /**
     * Return the formatted heading, with the unit of measure.
     * @return {string}
     */
    getHeading() {
        return this.heading.toString() + "°";
    }

    /**
     * Return the formatted vertical speed, with the unit of measure.
     * @return {string}
     */
    getVerticalSpeed() {
        return this.verticalSpeed.toString() + " fpm";
    }

    /**
     * Set flight details to the instance. Use FlightRadar24API.getFlightDetails(...) method to get it.
     * @param {object} flightDetails
     */
    setFlightDetails(flightDetails) {
        flightDetails = this.__createGetterMethodFor(flightDetails);

        // Get aircraft data.
        const aircraft = this.__getDetails(flightDetails.get("aircraft"));

        // Get airline data.
        const airline = this.__getDetails(flightDetails.get("airline"));

        // Get airport data.
        const airport = this.__getDetails(flightDetails.get("airport"));

        // Get destination data.
        const destAirport = this.__getDetails(airport.get("destination"));
        const destAirportCode = this.__getDetails(destAirport.get("code"));
        const destAirportInfo = this.__getDetails(destAirport.get("info"));
        const destAirportPosition = this.__getDetails(destAirport.get("position"));
        const destAirportCountry = this.__getDetails(destAirportPosition.get("country"));
        const destAirportTimezone = this.__getDetails(destAirport.get("timezone"));

        // Get origin data.
        const origAirport = this.__getDetails(airport.get("origin"));
        const origAirportCode = this.__getDetails(origAirport.get("code"));
        const origAirportInfo = this.__getDetails(origAirport.get("info"));
        const origAirportPosition = this.__getDetails(origAirport.get("position"));
        const origAirportCountry = this.__getDetails(origAirportPosition.get("country"));
        const origAirportTimezone = this.__getDetails(origAirport.get("timezone"));

        // Get flight history.
        const history = this.__getDetails(flightDetails.get("flightHistory"));

        // Get flight status.
        const status = this.__getDetails(flightDetails.get("status"));

        // Aircraft information.
        this.aircraftAge = this.__getInfo(aircraft.get("age"));
        this.aircraftCountryId = this.__getInfo(aircraft.get("countryId"));
        this.aircraftHistory = history.get("aircraft", []);
        this.aircraftImages = aircraft.get("images", []);
        this.aircraftModel = this.__getInfo(this.__getDetails(aircraft.get("model")).get("text"));

        // Airline information.
        this.airlineName = this.__getInfo(airline.get("name"));
        this.airlineShortName = this.__getInfo(airline.get("short"));

        // Destination airport position.
        this.destinationAirportAltitude = this.__getInfo(destAirportPosition.get("altitude"));
        this.destinationAirportCountryCode = this.__getInfo(destAirportCountry.get("code"));
        this.destinationAirportCountryName = this.__getInfo(destAirportCountry.get("name"));
        this.destinationAirportLatitude = this.__getInfo(destAirportPosition.get("latitude"));
        this.destinationAirportLongitude = this.__getInfo(destAirportPosition.get("longitude"));

        // Destination airport information.
        this.destinationAirportIcao = this.__getInfo(destAirportCode.get("icao"));
        this.destinationAirportBaggage = this.__getInfo(destAirportInfo.get("baggage"));
        this.destinationAirportGate = this.__getInfo(destAirportInfo.get("gate"));
        this.destinationAirportName = this.__getInfo(destAirport.get("name"));
        this.destinationAirportTerminal = this.__getInfo(destAirportInfo.get("terminal"));
        this.destinationAirportVisible = this.__getInfo(destAirport.get("visible"));
        this.destinationAirportWebsite = this.__getInfo(destAirport.get("website"));

        // Destination airport timezone.
        this.destinationAirportTimezoneAbbr = this.__getInfo(destAirportTimezone.get("abbr"));
        this.destinationAirportTimezoneAbbrName = this.__getInfo(destAirportTimezone.get("abbrName"));
        this.destinationAirportTimezoneName = this.__getInfo(destAirportTimezone.get("name"));
        this.destinationAirportTimezoneOffset = this.__getInfo(destAirportTimezone.get("offset"));
        this.destinationAirportTimezoneOffsethours = this.__getInfo(destAirportTimezone.get("offsetHours"));

        // Origin airport position.
        this.originAirportAltitude = this.__getInfo(origAirportPosition.get("altitude"));
        this.originAirportCountryCode = this.__getInfo(origAirportCountry.get("code"));
        this.originAirportCountryName = this.__getInfo(origAirportCountry.get("name"));
        this.originAirportLatitude = this.__getInfo(origAirportPosition.get("latitude"));
        this.originAirportLongitude = this.__getInfo(origAirportPosition.get("longitude"));

        // Origin airport information.
        this.originAirportIcao = this.__getInfo(origAirportCode.get("icao"));
        this.originAirportBaggage = this.__getInfo(origAirportInfo.get("baggage"));
        this.originAirportGate = this.__getInfo(origAirportInfo.get("gate"));
        this.originAirportName = this.__getInfo(origAirport.get("name"));
        this.originAirportTerminal = this.__getInfo(origAirportInfo.get("terminal"));
        this.originAirportVisible = this.__getInfo(origAirport.get("visible"));
        this.originAirportWebsite = this.__getInfo(origAirport.get("website"));

        // Origin airport timezone.
        this.originAirportTimezoneAbbr = this.__getInfo(origAirportTimezone.get("abbr"));
        this.originAirportTimezoneAbbrName = this.__getInfo(origAirportTimezone.get("abbrName"));
        this.originAirportTimezoneName = this.__getInfo(origAirportTimezone.get("name"));
        this.originAirportTimezoneOffset = this.__getInfo(origAirportTimezone.get("offset"));
        this.originAirportTimezoneOffsethours = this.__getInfo(origAirportTimezone.get("offsetHours"));

        // Flight status.
        this.statusIcon = this.__getInfo(status.get("icon"));
        this.statusText = this.__getInfo(status.get("text"));

        // Time details.
        this.timeDetails = this.__getDetails(flightDetails.get("time"));

        // Flight trail.
        this.trail = flightDetails.get("trail", []);
    }
}

module.exports = Flight;
