const Core = require("./core");
const APIRequest = require("./request");
const Airport = require("./entities/airport");
const Flight = require("./entities/flight");
const FlightTrackerConfig = require("./flightTrackerConfig");
const {AirportNotFoundError, LoginError} = require("./errors");
const {isNumeric} = require("./util");


/**
 * Main class of the FlightRadarAPI
 */
class FlightRadar24API {
    /**
     * Constructor of FlightRadar24API class
     */
    constructor() {
        this.__flightTrackerConfig = new FlightTrackerConfig();
        this.__loginData = null;
    }

    /**
     * Return a list with all airlines.
     *
     * @return {object}
     */
    async getAirlines() {
        const response = new APIRequest(Core.airlinesDataUrl, null, Core.jsonHeaders);
        await response.receive();

        return (await response.getContent())["rows"];
    }

    /**
     * Download the logo of an airline from FlightRadar24 and return it as bytes.
     *
     * @param {string} iata - IATA of the airline
     * @param {string} icao - ICAO of the airline
     * @return {[object, string]}
     */
    async getAirlineLogo(iata, icao) {
        iata = iata.toUpperCase();
        icao = icao.toUpperCase();

        const firstLogoUrl = Core.airlineLogoUrl.format(iata, icao);

        // Try to get the image by the first URL option.
        let response = new APIRequest(firstLogoUrl, null, Core.imageHeaders, null, null, [403]);
        await response.receive();

        let statusCode = response.getStatusCode();

        if (!statusCode.toString().startsWith("4")) {
            const splitUrl = firstLogoUrl.split(".");
            return [(await response.getContent()), splitUrl[splitUrl.length - 1]];
        }

        // Get the image by the second airline logo URL.
        const secondLogoUrl = Core.alternativeAirlineLogoUrl.format(icao);

        response = new APIRequest(secondLogoUrl, null, Core.imageHeaders);
        await response.receive();

        statusCode = response.getStatusCode();

        if (!statusCode.toString().startsWith("4")) {
            const splitUrl = secondLogoUrl.split(".");
            return [(await response.getContent()), splitUrl[splitUrl.length - 1]];
        }
    }

    /**
     * Return basic information about a specific airport.
     *
     * @param {string} code - ICAO or IATA of the airport
     * @param {boolean} details - If true, it returns flights with detailed information
     * @return {Airport}
     */
    async getAirport(code, details = false) {
        if (4 < code.length || code.length < 3) {
            throw new Error("The code '" + code + "' is invalid. It must be the IATA or ICAO of the airport.");
        }

        if (details) {
            const airport = new Airport();

            const airportDetails = await this.getAirportDetails(code);
            airport.setAirportDetails(airportDetails);

            return airport;
        }

        const response = new APIRequest(Core.airportDataUrl.format(code), null, Core.jsonHeaders);
        await response.receive();

        const info = (await response.getContent())["details"];

        if (info === undefined) {
            throw new AirportNotFoundError("Could not find an airport by the code '" + code + "'.");
        }
        return new Airport({}, info);
    }

    /**
     * Return the airport details from FlightRadar24.
     *
     * @param {string} code - ICAO or IATA of the airport
     * @param {number} [flightLimit=100] - Limit of flights related to the airport
     * @param {number} [page=1] - Page of result to display
     * @return {object}
     */
    async getAirportDetails(code, flightLimit = 100, page = 1) {
        if (4 < code.length || code.length < 3) {
            throw new Error("The code '" + code + "' is invalid. It must be the IATA or ICAO of the airport.");
        }

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

        if (response.getStatusCode() === 400 && content?.["errors"] !== undefined) {
            const errors = content["errors"]?.["errors"]?.["parameters"];
            const limit = errors?.["limit"];

            if (limit !== undefined) {
                throw new Error(limit["notBetween"]);
            }
            throw new AirportNotFoundError("Could not find an airport by the code '" + code + "'.", errors);
        }

        const result = content["result"]["response"];

        // Check whether it received data of an airport.
        const data = result?.["airport"]?.["pluginData"];
        const dataCount = typeof data === "object" ? Object.entries(data).length : 0;

        const runways = data?.["runways"];
        const runwaysCount = typeof runways === "object" ? Object.entries(runways).length : 0;

        if (data?.["details"] === undefined && runwaysCount == 0 && dataCount <= 3) {
            throw new AirportNotFoundError("Could not find an airport by the code '" + code + "'.");
        }

        // Return the airport details.
        return result;
    }

    /**
     * Return airport disruptions.
     *
     * @return {object}
     */
    async getAirportDisruptions() {
        const response = new APIRequest(Core.airportDisruptionsUrl, null, Core.jsonHeaders);
        await response.receive();

        return await response.getContent();
    }

    /**
     * Return a list with all airports.
     *
     * @return {Array<Airport>}
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
     * Return the bookmarks from the FlightRadar24 account.
     *
     * @return {object}
     */
    async getBookmarks() {
        if (!this.isLoggedIn()) {
            throw new LoginError("You must log in to your account.");
        }

        const headers = {...Core.jsonHeaders};
        headers["accesstoken"] = this.getLoginData()["accessToken"];

        const cookies = this.__loginData["cookies"];

        const response = new APIRequest(Core.bookmarksUrl, null, headers, null, cookies);
        await response.receive();

        return await response.getContent();
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
     * @param {string} country - Country name
     * @return {[object, string]}
     */
    async getCountryFlag(country) {
        const flagUrl = Core.countryFlagUrl.format(country.toLowerCase().replace(" ", "-"));
        const headers = {...Core.imageHeaders};

        if (headers.hasOwnProperty("origin")) {
            delete headers["origin"]; // Does not work for this request.
        }

        const response = new APIRequest(flagUrl, null, headers);
        await response.receive();

        const statusCode = response.getStatusCode();

        if (!statusCode.toString().startsWith("4")) {
            const splitUrl = flagUrl.split(".");
            return [(await response.getContent()), splitUrl[splitUrl.length - 1]];
        }
    }

    /**
     * Return the flight details from Data Live FlightRadar24.
     *
     * @param {Flight} flight - A Flight instance
     * @return {object}
     */
    async getFlightDetails(flight) {
        const response = new APIRequest(Core.flightDataUrl.format(flight.id), null, Core.jsonHeaders);
        await response.receive();

        return (await response.getContent());
    }

    /**
     * Return a list of flights. See more options at setFlightTrackerConfig() method.
     *
     * @param {string} [airline] - The airline ICAO. Ex: "DAL"
     * @param {string} [bounds] - Coordinates (y1, y2 ,x1, x2). Ex: "75.78,-75.78,-427.56,427.56"
     * @param {string} [registration] - Aircraft registration
     * @param {string} [aircraftType] - Aircraft model code. Ex: "B737"
     * @param {boolean} [details] -  If true, it returns flights with detailed information
     * @return {Array<Flight>}
     */
    async getFlights(airline = null, bounds = null, registration = null, aircraftType = null, details = false) {
        const requestParams = {...this.__flightTrackerConfig};

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

        for (const flightId in content) {
            if (!Object.prototype.hasOwnProperty.call(content, flightId)) { // guard-for-in
                continue;
            }

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
        return new FlightTrackerConfig({...this.__flightTrackerConfig});
    }

    /**
     * Download historical data of a flight.
     *
     * @param {Flight} flight - A Flight instance.
     * @param {string} fileType - Must be "CSV" or "KML"
     * @param {number} timestamp - A Unix timestamp
     */
    async getHistoryData(flight, fileType, timestamp) {
        if (!this.isLoggedIn()) {
            throw new LoginError("You must log in to your account.");
        }

        fileType = fileType.toLowerCase();

        if (!["csv", "kml"].includes(fileType)) {
            throw new Error("File type '" + fileType + "' is not supported. Only CSV and KML are supported.");
        }

        const response = new APIRequest(
            Core.historicalDataUrl.format(flight.id, fileType, timestamp),
            null, Core.jsonHeaders, null, self.__loginData["cookies"],
        );
        await response.receive();

        const content = await response.getContent();
        return content;
    }

    /**
     * Return the user data.
     *
     * @return {object}
     */
    getLoginData() {
        if (!this.isLoggedIn()) {
            throw new LoginError("You must log in to your account.");
        }
        return {...this.__loginData["userData"]};
    }

    /**
     * Return the most tracked data.
     *
     * @return {object}
     */
    async getMostTracked() {
        const response = new APIRequest(Core.mostTrackedUrl, null, Core.jsonHeaders);
        await response.receive();

        return await response.getContent();
    }

    /**
     * Return boundaries of volcanic eruptions and ash clouds impacting aviation.
     *
     * @return {object}
     */
    async getVolcanicEruptions() {
        const response = new APIRequest(Core.volcanicEruptionDataUrl, null, Core.jsonHeaders);
        await response.receive();

        return await response.getContent();
    }

    /**
     * Return all major zones on the globe.
     *
     * @return {object}
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
     * Return the search result.
     *
     * @param {string} query
     * @param {number} [limit=50]
     * @return {object}
     */
    async search(query, limit = 50) {
        const url = Core.searchDataUrl.format(query, limit);

        const response = new APIRequest(url, null, Core.jsonHeaders);
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
            if (!Object.prototype.hasOwnProperty.call(countDict, name)) { // guard-for-in
                continue;
            }

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
     * @return {undefined}
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
            if (typeof content === "object") {
                throw new LoginError(content["message"]);
            }
            else {
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
     * @param {FlightTrackerConfig} [flightTrackerConfig] - If null, set to the default config.
     * @param {object} [config={}] - Config as an JSON object
     * @return {undefined}
     */
    async setFlightTrackerConfig(flightTrackerConfig = null, config = {}) {
        if (flightTrackerConfig != null) {
            this.__flightTrackerConfig = flightTrackerConfig;
        }

        for (const key in config) {
            if (Object.prototype.hasOwnProperty.call(config, key)) { // guard-for-in
                const value = config[key].toString();
                this.__flightTrackerConfig[key] = value;
            }
        }
    }
}

module.exports = FlightRadar24API;
