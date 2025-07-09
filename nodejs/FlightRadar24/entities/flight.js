const Entity = require("./entity");

/**
 * Flight representation.
 */
class Flight extends Entity {
    static __heloModels: string[] = ["A002", "A109", "A119", "A129", "A139", "A149", "A169", "A189", "ALH", "ALO2", "ALO3", "AS32", "AS3B", "AS50", "AS55", "AS65", "B06", "B06T", "B105", "B212", "B222", "B230", "B407", "B412", "B427", "B429", "B430", "B47G", "B47J", "BK17", "BSTP", "EC20", "EC25", "EC30", "EC35", "EC45", "EC55", "EC75", "EH10", "EXPL", "FREL", "GAZL", "H2", "H269", "H47", "H500", "H53", "H53S", "H60", "H64", "HUCO", "KA32", "KA50", "KA52", "KMAX", "LAMA", "LYNX", "MI26", "MI38", "MI8", "NH90", "OH1", "PUMA", "R22", "R44", "R66", "RVAL", "S61", "S61R", "S76", "S92", "SUCO", "TIGR", "UH1", "UH1Y", "V22", "B505", "G2CA", "GYRO", "H160", "CDUS", "MM24"];
    
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
     *
     * @param {object} info
     * @return {boolean}
     */
    checkInfo(info) {
        const comparisonFunctions = {"max": Math.max, "min": Math.min};

        for (let key in info) {
            if (!Object.prototype.hasOwnProperty.call(info, key)) { // guard-for-in
                continue;
            }

            let prefix = key.slice(0, 3);
            const value = info[key];

            // Separate the comparison prefix if it exists.
            if ((prefix === "max") || (prefix === "min")) {
                key = key[3].toLowerCase() + key.slice(4, key.length);
            }
            else {
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
     *
     * @return {string}
     */
    getAltitude() {
        return this.altitude.toString() + " ft";
    }

    /**
     * Return the formatted flight level, with the unit of measure.
     *
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
     *
     * @return {string}
     */
    getGroundSpeed() {
        const sufix = this.groundSpeed > 1 ? "s" : "";
        return this.groundSpeed.toString() + " kt" + sufix;
    }

    /**
     * Return the formatted heading, with the unit of measure.
     *
     * @return {string}
     */
    getHeading() {
        return this.heading.toString() + "°";
    }

    /**
     * Return the formatted vertical speed, with the unit of measure.
     *
     * @return {string}
     */
    getVerticalSpeed() {
        return this.verticalSpeed.toString() + " fpm";
    }

    /**
     * Set flight details to the instance. Use FlightRadar24API.getFlightDetails(...) method to get it.
     *
     * @param {object} flightDetails
     * @return {undefined}
     */
    setFlightDetails(flightDetails) {
        // Get aircraft data.
        const aircraft = flightDetails["aircraft"];

        // Get airline data.
        const airline = flightDetails?.["airline"];

        // Get airport data.
        const airport = flightDetails?.["airport"];

        // Get destination data.
        const destAirport = airport?.["destination"];
        const destAirportCode = destAirport?.["code"];
        const destAirportInfo = destAirport?.["info"];
        const destAirportPosition = destAirport?.["position"];
        const destAirportCountry = destAirportPosition?.["country"];
        const destAirportTimezone = destAirport?.["timezone"];

        // Get origin data.
        const origAirport = airport?.["origin"];
        const origAirportCode = origAirport?.["code"];
        const origAirportInfo = origAirport?.["info"];
        const origAirportPosition = origAirport?.["position"];
        const origAirportCountry = origAirportPosition?.["country"];
        const origAirportTimezone = origAirport?.["timezone"];

        // Get flight history.
        const history = flightDetails?.["flightHistory"];

        // Get flight status.
        const status = flightDetails?.["status"];

        // Aircraft information.
        this.aircraftAge = this.__getInfo(aircraft?.["age"]);
        this.aircraftCountryId = this.__getInfo(aircraft?.["countryId"]);
        this.aircraftHistory = this.__getInfo(history?.["aircraft"], []);
        this.aircraftImages = this.__getInfo(aircraft?.["images"], []);
        this.aircraftModel = this.__getInfo(aircraft?.["model"]?.["text"]);
        this.aircraftIsHelo = this.__heloModels.indexOf(this.aircraftModel) > -1;

        // Airline information.
        this.airlineName = this.__getInfo(airline?.["name"]);
        this.airlineShortName = this.__getInfo(airline?.["short"]);

        // Destination airport position.
        this.destinationAirportAltitude = this.__getInfo(destAirportPosition?.["altitude"]);
        this.destinationAirportCountryCode = this.__getInfo(destAirportCountry?.["code"]);
        this.destinationAirportCountryName = this.__getInfo(destAirportCountry?.["name"]);
        this.destinationAirportLatitude = this.__getInfo(destAirportPosition?.["latitude"]);
        this.destinationAirportLongitude = this.__getInfo(destAirportPosition?.["longitude"]);

        // Destination airport information.
        this.destinationAirportIcao = this.__getInfo(destAirportCode?.["icao"]);
        this.destinationAirportBaggage = this.__getInfo(destAirportInfo?.["baggage"]);
        this.destinationAirportGate = this.__getInfo(destAirportInfo?.["gate"]);
        this.destinationAirportName = this.__getInfo(destAirport?.["name"]);
        this.destinationAirportTerminal = this.__getInfo(destAirportInfo?.["terminal"]);
        this.destinationAirportVisible = this.__getInfo(destAirport?.["visible"]);
        this.destinationAirportWebsite = this.__getInfo(destAirport?.["website"]);

        // Destination airport timezone.
        this.destinationAirportTimezoneAbbr = this.__getInfo(destAirportTimezone?.["abbr"]);
        this.destinationAirportTimezoneAbbrName = this.__getInfo(destAirportTimezone?.["abbrName"]);
        this.destinationAirportTimezoneName = this.__getInfo(destAirportTimezone?.["name"]);
        this.destinationAirportTimezoneOffset = this.__getInfo(destAirportTimezone?.["offset"]);
        this.destinationAirportTimezoneOffsetHours = this.__getInfo(destAirportTimezone?.["offsetHours"]);

        // Origin airport position.
        this.originAirportAltitude = this.__getInfo(origAirportPosition?.["altitude"]);
        this.originAirportCountryCode = this.__getInfo(origAirportCountry?.["code"]);
        this.originAirportCountryName = this.__getInfo(origAirportCountry?.["name"]);
        this.originAirportLatitude = this.__getInfo(origAirportPosition?.["latitude"]);
        this.originAirportLongitude = this.__getInfo(origAirportPosition?.["longitude"]);

        // Origin airport information.
        this.originAirportIcao = this.__getInfo(origAirportCode?.["icao"]);
        this.originAirportBaggage = this.__getInfo(origAirportInfo?.["baggage"]);
        this.originAirportGate = this.__getInfo(origAirportInfo?.["gate"]);
        this.originAirportName = this.__getInfo(origAirport?.["name"]);
        this.originAirportTerminal = this.__getInfo(origAirportInfo?.["terminal"]);
        this.originAirportVisible = this.__getInfo(origAirport?.["visible"]);
        this.originAirportWebsite = this.__getInfo(origAirport?.["website"]);

        // Origin airport timezone.
        this.originAirportTimezoneAbbr = this.__getInfo(origAirportTimezone?.["abbr"]);
        this.originAirportTimezoneAbbrName = this.__getInfo(origAirportTimezone?.["abbrName"]);
        this.originAirportTimezoneName = this.__getInfo(origAirportTimezone?.["name"]);
        this.originAirportTimezoneOffset = this.__getInfo(origAirportTimezone?.["offset"]);
        this.originAirportTimezoneOffsetHours = this.__getInfo(origAirportTimezone?.["offsetHours"]);

        // Flight status.
        this.statusIcon = this.__getInfo(status?.["icon"]);
        this.statusText = this.__getInfo(status?.["text"]);

        // Time details.
        this.timeDetails = this.__getInfo(flightDetails?.["time"], {});

        // Flight trail.
        this.trail = this.__getInfo(flightDetails?.["trail"], []);
    }
}

module.exports = Flight;
