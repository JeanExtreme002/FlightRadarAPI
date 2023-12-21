const Core = require("./core");
const APIRequest = require("./request");
const Airport = require("./entities/airport");
const Flight = require("./entities/flight");
const {LoginError} = require("./errors");


class FlightTrackerConfig {
    /**
     * Data class with settings of the Real Time Flight Tracker.
     */

    faa = "1";
    satellite = "1";
    mlat = "1";
    flarm = "1";
    adsb = "1";
    gnd = "1";
    air = "1";
    vehicles = "1";
    estimated = "1";
    maxage = "14400";
    gliders = "1";
    stats = "1";
    limit = "5000";

    __proxyHandler = {
        set: function(target, key, value) {
            if (!target.hasOwnProperty(key)) {
                throw new Error("Unknown option: '" + key + "'");
            }
            if ((typeof(value) != "number") && (!target.__isNumeric(value))) {
                throw new Error("Value must be a decimal. Got '" + key + "'");
            }
            target[key] = value.toString();
        },
    };

    constructor(data) {
        for (const key in data) {
            const value = data[key];

            if (this.hasOwnProperty(key) && (typeof(value) == "number" || this.__isNumeric(value))) {
                this[key] = value;
            }
        }
        return new Proxy(this, this.__proxyHandler);
    }

    __isNumeric(string) {
        for (let index = 0; index < string.length; index++) {
            if (!"0123456789".includes(string[index])) {
                return false;
            }
        }
        return true;
    }

    asdict() {
        const dict = {};

        for (const key in this) {
            if (!key.startsWith("_")) {
                dict[key] = this[key];
            }
        }
        return dict;
    }
}

class FlightRadar24API {
    /**
     * Main class of the FlightRadarAPI
     */

    constructor() {
        this.__flightTrackerConfig = new FlightTrackerConfig();
        this.__loginData = null;
    }

    /**
     * Return a list with all airlines.
     */
    async getAirlines() {
        const response = new APIRequest(Core.airlinesDataUrl, null, Core.jsonHeaders);
        await response.receive();

        return (await response.getContent())["rows"];
    }

    /**
     * Download the logo of an airline from FlightRadar24 and return it as bytes.
     *
     * @param {string} iata
     * @param {string} icao
     */
    async getAirlineLogo(iata, icao) {
        iata = iata.toUpperCase();
        icao = icao.toUpperCase();

        let firstLogoUrl = Core.airlineLogoUrl.split("{}");
        firstLogoUrl = firstLogoUrl[0] + iata + firstLogoUrl[1] + icao + firstLogoUrl[2];

        // Try to get the image by the first URL option.
        let response = new APIRequest(firstLogoUrl, null, Core.imageHeaders, null, null, [403]);
        await response.receive();

        let statusCode = response.getStatusCode();

        if (!statusCode.toString().startsWith("4")) {
            const splitUrl = firstLogoUrl.split(".");
            return [(await response.getContent()), splitUrl[splitUrl.length]];
        }

        // Get the image by the second airline logo URL.
        const secondLogoUrl = Core.alternativeAirlineLogoUrl.replace("{}", icao);

        response = new APIRequest(secondLogoUrl, null, Core.imageHeaders);
        await response.receive();

        statusCode = response.getStatusCode();

        if (!statusCode.toString().startsWith("4")) {
            return [(await response.getContent()), secondLogoUrl.split(".")[-1]];
        }
    }

    /**
     * Return information about a specific airport.
     *
     * @param {string} code - ICAO or IATA of the airport
     * @return {Airport}
     */
    async getAirport(code) {
        const response = new APIRequest(Core.airportDataUrl.replace("{}", code), null, Core.jsonHeaders);
        await response.receive();

        return new Airport({}, (await response.getContent())["details"]);
    }

    /**
     * Return the airport details from FlightRadar24.
     *
     * @param {string} code - ICAO or IATA of the airport
     * @param {number} flightLimit - Limit of flights related to the airport
     * @param {number} page - Page of result to display
     */
    async getAirportDetails(code, flightLimit = 100, page = 1) {
        const requestParams = {"format": "json"};

        if (this.__loginData != null) {
            requestParams["token"] = this.__loginData["cookies"]["_frPl"];
        }

        // Insert the method parameters into the dictionary for the request.
        requestParams["code"] = code;
        requestParams["limit"] = flightLimit;
        requestParams["page"] = page;

        // Request details from the FlightRadar24.
        const response = new APIRequest(Core.apiAirportDataUrl, requestParams, Core.jsonHeaders, null, null, [400]);
        await response.receive();

        const content = await response.getContent();

        if (response.getStatusCode() == 400 && typeof(content) == "object" && content["errors"]) {
            throw Error(content["errors"]["errors"]["parameters"]["limit"]["notBetween"]);
        }
        return content["result"]["response"];
    }

    /**
     * Return a list with all airports.
     */
    async getAirports() {
        const response = new APIRequest(Core.airportsDataUrl, null, Core.jsonHeaders);
        await response.receive();

        const content = await response.getContent();
        const airports = [];

        for (const airportData of content["rows"]) {
            const airport = new Airport(airportData);
            airports.push(airport);
        }
        return airports;
    }

    /**
     * Convert coordinate dictionary to a string "y1, y2, x1, x2".
     *
     * @param {object} zone - Dictionary containing the following keys: tl_y, tl_x, br_y, br_x
     * @return {string}
     */
    getBounds(zone) {
        return "" + zone["tl_y"] + "," + zone["br_y"] + "," + zone["tl_x"] + "," + zone["br_x"];
    }

    /**
     * Convert a point coordinate and a radius to a string "y1, y2, x1, x2".
     *
     * @param {number} latitude - Latitude of the point
     * @param {number} longitude - Longitude of the point
     * @param {number} radius - Radius in meters to create area around the point
     * @return {string}
     */
    getBoundsByPoint(latitude, longitude, radius) {
        const halfSideInKm = Math.abs(radius) / 1000;

        Math.rad2deg = (x) => x * (180 / Math.PI);
        Math.radians = (x) => x * (Math.PI / 180);

        const lat = Math.radians(latitude);
        const lon = Math.radians(longitude);

        const approxEarthRadius = 6371;
        const hypotenuseDistance = Math.sqrt(2 * (Math.pow(halfSideInKm, 2)));

        const latMin = Math.asin(
            Math.sin(lat) * Math.cos(hypotenuseDistance / approxEarthRadius) +
            Math.cos(lat) *
            Math.sin(hypotenuseDistance / approxEarthRadius) *
            Math.cos(225 * (Math.PI / 180)),
        );
        const lonMin = lon + Math.atan2(
            Math.sin(225 * (Math.PI / 180)) *
            Math.sin(hypotenuseDistance / approxEarthRadius) *
            Math.cos(lat),
            Math.cos(hypotenuseDistance / approxEarthRadius) -
            Math.sin(lat) * Math.sin(latMin),
        );

        const latMax = Math.asin(
            Math.sin(lat) * Math.cos(hypotenuseDistance / approxEarthRadius) +
            Math.cos(lat) *
            Math.sin(hypotenuseDistance / approxEarthRadius) *
            Math.cos(45 * (Math.PI / 180)),
        );
        const lonMax = lon + Math.atan2(
            Math.sin(45 * (Math.PI / 180)) *
            Math.sin(hypotenuseDistance / approxEarthRadius) *
            Math.cos(lat),
            Math.cos(hypotenuseDistance / approxEarthRadius) -
            Math.sin(lat) * Math.sin(latMax),
        );

        const zone = {
            "tl_y": Math.rad2deg(latMax),
            "br_y": Math.rad2deg(latMin),
            "tl_x": Math.rad2deg(lonMin),
            "br_x": Math.rad2deg(lonMax),
        };
        return this.getBounds(zone);
    }

    /**
     * Download the flag of a country from FlightRadar24 and return it as bytes.
     *
     * @param {string} - Country name
     */
    async getCountryFlag(country) {
        const flagUrl = Core.countryFlagUrl.replace("{}", country.toLowerCase().replace(" ", "-"));
        const headers = {...Core.imageHeaders};

        if (headers.hasOwnProperty("origin")) {
            delete headers["origin"]; // Does not work for this request.
        }

        const response = new APIRequest(flagUrl, null, headers);
        await response.receive();

        const statusCode = response.getStatusCode();

        if (!statusCode.toString().startsWith("4")) {
            const splitUrl = flagUrl.split(".");
            return [(await response.getContent()), splitUrl[splitUrl.length]];
        }
    }

    /**
     * Return the flight details from Data Live FlightRadar24.
     *
     * @param {Flight} flight - A Flight instance.
     */
    async getFlightDetails(flight) {
        const response = new APIRequest(Core.flightDataUrl.replace("{}", flight.id), null, Core.jsonHeaders);
        await response.receive();

        return (await response.getContent());
    }

    /**
     * Return a list of flights. See more options at setFlightTrackerConfig() method.
     *
     * @param {string} airline - The airline ICAO. Ex: "DAL"
     * @param {string} bounds - Coordinates (y1, y2 ,x1, x2). Ex: "75.78,-75.78,-427.56,427.56"
     * @param {string} registration - Aircraft registration
     * @param {string} aircraftType - Aircraft model code. Ex: "B737"
     * @param {boolean} details -  If true, it returns flights with detailed information
     */
    async getFlights(airline = null, bounds = null, registration = null, aircraftType = null, details = false) {
        const requestParams = this.__flightTrackerConfig.asdict();

        if (this.__loginData != null) {
            requestParams["enc"] = this.__loginData["cookies"]["_frPl"];
        }

        // Insert the method parameters into the dictionary for the request.
        if (airline != null) {
            requestParams["airline"] = airline;
        }
        if (bounds != null) {
            requestParams["bounds"] = bounds.replace(",", "%2C");
        }
        if (registration != null) {
            requestParams["reg"] = registration;
        }
        if (aircraftType != null) {
            requestParams["type"] = aircraftType;
        }

        // Get all flights from Data Live FlightRadar24.
        const response = new APIRequest(Core.realTimeFlightTrackerDataUrl, requestParams, Core.jsonHeaders);
        await response.receive();

        const content = await response.getContent();
        const flights = [];

        function isNumeric(string) {
            for (let index = 0; index < string.length; index++) {
                if (!"0123456789".includes(string[index])) {
                    return false;
                }
            }
            return true;
        }

        for (const flightId in content) {
            const flightInfo = content[flightId];

            // Get flights only.
            if (!isNumeric(flightId[0])) {
                continue;
            }

            const flight = new Flight(flightId, flightInfo);
            flights.push(flight);

            // Set flight details.
            if (details) {
                const flightDetails = await this.getFlightDetails(flight);
                flight.setFlightDetails(flightDetails);
            }
        }

        return flights;
    }

    /**
     * Return a copy of the current config of the Real Time Flight Tracker, used by getFlights() method.
     *
     * @return {FlightTrackerConfig}
     */
    getFlightTrackerConfig() {
        return new FlightTrackerConfig(this.__flightTrackerConfig.asdict());
    }

    /**
     * Return the user data.
     */
    getLoginData() {
        if (!this.isLoggedIn()) {
            throw new LoginError("You must log in to your account.");
        }
        return {...this.__loginData["userData"]};
    }

    /**
     * Return the most tracked data.
     */
    async getMostTracked() {
        const response = new APIRequest(Core.mostTrackedUrl, null, Core.jsonHeaders);
        await response.receive();

        return await response.getContent();
    }

    /**
     * Return all major zones on the globe.
     */
    async getZones() {
        const response = new APIRequest(Core.zonesDataUrl, null, Core.jsonHeaders);
        await response.receive();

        const zones = await response.getContent();

        if (zones.hasOwnProperty("version")) {
            delete zones["version"];
        }
        return zones;
    }

    /**
     * Return the search result
     *
     * @param {string} query
     */
    async search(query) {
        const response = new APIRequest(Core.searchDataUrl.replace("{}", query), null, Core.jsonHeaders);
        await response.receive();

        const content = await response.getContent();

        let results = content["results"];
        results = results == null ? [] : results;

        let stats = content["stats"];
        stats = stats == null ? {} : stats;

        let countDict = stats["count"];
        countDict = countDict == null ? {} : countDict;

        let index = 0;
        let countedTotal = 0;

        const data = {};

        for (const name in countDict) {
            const count = countDict[name];

            data[name] = [];

            while (index < (countedTotal + count) && (index < results.length)) {
                data[name].push(results[index]);
                index++;
            }
            countedTotal += count;
        }

        return data;
    }

    /**
     * Check if the user is logged into the FlightRadar24 account.
     *
     * @return {boolean}
     */
    isLoggedIn() {
        return this.__loginData != null;
    }

    /**
     * Log in to a FlightRadar24 account.
     *
     * @param {string} user - Your email.
     * @param {string} password - Your password.
     */
    async login(user, password) {
        const data = {
            "email": user,
            "password": password,
            "remember": "true",
            "type": "web",
        };

        const response = new APIRequest(Core.userLoginUrl, null, Core.jsonHeaders, data);
        await response.receive();

        const statusCode = response.getStatusCode();
        const content = await response.getContent();

        if (!statusCode.toString().startsWith("2") || !content["success"]) {
            if (typeof(content) == "object") {
                throw new LoginError(content["message"]);
            } else {
                throw new LoginError("Your email or password is incorrect");
            }
        }

        this.__loginData = {
            "userData": content["userData"],
            "cookies": response.getCookies(),
        };
    }

    /**
     * Log out of the FlightRadar24 account.
     *
     * @return {boolean} - Return a boolean indicating that it successfully logged out of the server.
     */
    async logout() {
        if (this.__loginData == null) {
            return true;
        }

        const cookies = this.__loginData["cookies"];
        this.__loginData = null;

        const response = new APIRequest(Core.userLoginUrl, null, Core.jsonHeaders, null, cookies);
        await response.receive();

        return response.getStatusCode().toString().startsWith("2");
    }

    /**
     * Set config for the Real Time Flight Tracker, used by getFlights() method.
     *
     * @param {FlightTrackerConfig} flightTrackerConfig - If null, set to default config.
     */
    async setFlightTrackerConfig(flightTrackerConfig = null, config = {}) {
        if (flightTrackerConfig != null) {
            this.__flightTrackerConfig = flightTrackerConfig;
        }

        const currentConfigDict = this.__flightTrackerConfig.asdict();

        for (const key in config) {
            const value = config[key].toString();
            currentConfigDict[key] = value;
        }

        this.__flightTrackerConfig = new FlightTrackerConfig(currentConfigDict);
    }
}

module.exports = {FlightRadar24API, FlightTrackerConfig};
