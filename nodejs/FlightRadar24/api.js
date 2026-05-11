const Core = require("./core");
const {request} = require("./request");
const Airport = require("./entities/airport");
const Flight = require("./entities/flight");
const FlightTrackerConfig = require("./flightTrackerConfig");
const {AirportNotFoundError, LoginError} = require("./errors");
const {isNumeric, radians, rad2deg} = require("./util");
const {parseAirlinesHtml, parseAirportsHtml} = require("./parsers");


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
     * @return {Promise<Array<object>>}
     */
    async getAirlines() {
        const {content} = await request(Core.airlinesDataUrl, {headers: Core.htmlHeaders});
        return parseAirlinesHtml(content);
    }

    /**
     * Download the logo of an airline from FlightRadar24 and return it as bytes.
     * Returns null if the logo is not found.
     *
     * @param {string} iata - IATA of the airline
     * @param {string} icao - ICAO of the airline
     * @return {Promise<[object, string] | null>}
     */
    async getAirlineLogo(iata, icao) {
        iata = iata.toUpperCase();
        icao = icao.toUpperCase();

        const notFound = [403, 404];

        const firstLogoUrl = Core.airlineLogoUrl(iata, icao);
        let {content, statusCode} = await request(firstLogoUrl, {
            headers: Core.imageHeaders,
            allowedErrorCodes: notFound,
        });

        if (statusCode < 400) {
            return [content, firstLogoUrl.split(".").pop()];
        }

        const secondLogoUrl = Core.alternativeAirlineLogoUrl(icao);
        ({content, statusCode} = await request(secondLogoUrl, {
            headers: Core.imageHeaders,
            allowedErrorCodes: notFound,
        }));

        if (statusCode < 400) {
            return [content, secondLogoUrl.split(".").pop()];
        }

        return null;
    }

    /**
     * Return basic information about a specific airport.
     *
     * @param {string} code - ICAO or IATA of the airport
     * @param {boolean} details - If true, it returns flights with detailed information
     * @return {Promise<Airport>}
     */
    async getAirport(code, details = false) {
        if (code.length < 3 || code.length > 4) {
            throw new Error("The code '" + code + "' is invalid. It must be the IATA or ICAO of the airport.");
        }

        if (details) {
            const airport = new Airport();
            airport.setAirportDetails(await this.getAirportDetails(code));
            return airport;
        }

        const {content} = await request(Core.airportDataUrl(code), {headers: Core.jsonHeaders});
        const info = content["details"];

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
     * @return {Promise<object>}
     */
    async getAirportDetails(code, flightLimit = 100, page = 1) {
        if (code.length < 3 || code.length > 4) {
            throw new Error("The code '" + code + "' is invalid. It must be the IATA or ICAO of the airport.");
        }

        const params = {"format": "json", "code": code, "limit": flightLimit, "page": page};

        if (this.__loginData !== null) {
            params["token"] = this.__loginData["cookies"]["_frPl"];
        }

        const {content, statusCode} = await request(Core.apiAirportDataUrl, {
            params,
            headers: Core.jsonHeaders,
            allowedErrorCodes: [400],
        });

        if (statusCode === 400 && content?.["errors"] !== undefined) {
            const errors = content["errors"]?.["errors"]?.["parameters"];
            const limit = errors?.["limit"];

            if (limit !== undefined) {
                throw new Error(limit["notBetween"]);
            }
            throw new AirportNotFoundError("Could not find an airport by the code '" + code + "'.", errors);
        }

        const result = content["result"]["response"];
        const data = result?.["airport"]?.["pluginData"];
        const dataCount = typeof data === "object" ? Object.entries(data).length : 0;

        const runways = data?.["runways"];
        const runwaysCount = typeof runways === "object" ? Object.entries(runways).length : 0;

        if (data?.["details"] === undefined && runwaysCount === 0 && dataCount <= 3) {
            throw new AirportNotFoundError("Could not find an airport by the code '" + code + "'.");
        }

        return result;
    }

    /**
     * Return airport disruptions.
     *
     * @return {Promise<object>}
     */
    async getAirportDisruptions() {
        const {content} = await request(Core.airportDisruptionsUrl, {headers: Core.jsonHeaders});
        return content;
    }

    /**
     * Return a list with all airports for specified countries.
     *
     * @param {Array<string>} countries - Array of country names from Countries enum
     * @return {Promise<Array<Airport>>}
     */
    async getAirports(countries) {
        const results = await Promise.all(countries.map(async (countryName) => {
            const countryHref = Core.airportsDataUrl + "/" + countryName;
            const {content} = await request(countryHref, {headers: Core.htmlHeaders});
            return parseAirportsHtml(content, countryHref);
        }));

        return results.flat();
    }

    /**
     * Return the bookmarks from the FlightRadar24 account.
     *
     * @return {Promise<object>}
     */
    async getBookmarks() {
        if (!this.isLoggedIn()) {
            throw new LoginError("You must log in to your account.");
        }

        const headers = {...Core.jsonHeaders, "accesstoken": this.getLoginData()["accessToken"]};
        const {content} = await request(Core.bookmarksUrl, {
            headers,
            cookies: this.__loginData["cookies"],
        });

        return content;
    }

    /**
     * Convert coordinate dictionary to a string "y1, y2, x1, x2".
     *
     * @param {object} zone - Dictionary containing the following keys: tl_y, tl_x, br_y, br_x
     * @return {string}
     */
    getBounds(zone) {
        return `${zone["tl_y"]},${zone["br_y"]},${zone["tl_x"]},${zone["br_x"]}`;
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

        const lat = radians(latitude);
        const lon = radians(longitude);

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

        return this.getBounds({
            "tl_y": rad2deg(latMax),
            "br_y": rad2deg(latMin),
            "tl_x": rad2deg(lonMin),
            "br_x": rad2deg(lonMax),
        });
    }

    /**
     * Download the flag of a country from FlightRadar24 and return it as bytes.
     * Returns null if the flag is not found.
     *
     * @param {string} country - Country name
     * @return {Promise<[object, string] | null>}
     */
    async getCountryFlag(country) {
        const flagUrl = Core.countryFlagUrl(country.toLowerCase().replaceAll(" ", "-"));

        const headers = {...Core.imageHeaders};
        delete headers["origin"];

        const {content, statusCode} = await request(flagUrl, {
            headers,
            allowedErrorCodes: [403, 404],
        });

        if (statusCode < 400) {
            return [content, flagUrl.split(".").pop()];
        }

        return null;
    }

    /**
     * Return the flight details from Data Live FlightRadar24.
     *
     * @param {Flight} flight - A Flight instance
     * @return {Promise<object>}
     */
    async getFlightDetails(flight) {
        const {content} = await request(Core.flightDataUrl(flight.id), {headers: Core.jsonHeaders});
        return content;
    }

    /**
     * Return a list of flights. See more options at setFlightTrackerConfig() method.
     *
     * @param {string} [airline] - The airline ICAO. Ex: "DAL"
     * @param {string} [bounds] - Coordinates (y1, y2 ,x1, x2). Ex: "75.78,-75.78,-427.56,427.56"
     * @param {string} [registration] - Aircraft registration
     * @param {string} [aircraftType] - Aircraft model code. Ex: "B737"
     * @param {boolean} [details] -  If true, it returns flights with detailed information
     * @return {Promise<Array<Flight>>}
     */
    async getFlights(airline = null, bounds = null, registration = null, aircraftType = null, details = false) {
        const params = {...this.__flightTrackerConfig};

        if (this.__loginData !== null) {
            params["enc"] = this.__loginData["cookies"]["_frPl"];
        }
        if (airline !== null) params["airline"] = airline;
        if (bounds !== null) params["bounds"] = bounds;
        if (registration !== null) params["reg"] = registration;
        if (aircraftType !== null) params["type"] = aircraftType;

        const {content} = await request(Core.realTimeFlightTrackerDataUrl, {
            params,
            headers: Core.jsonHeaders,
        });

        const flights = [];

        for (const flightId in content) {
            if (!Object.prototype.hasOwnProperty.call(content, flightId)) {
                continue;
            }
            if (!isNumeric(flightId[0])) {
                continue;
            }
            flights.push(new Flight(flightId, content[flightId]));
        }

        if (details) {
            await Promise.all(flights.map(async (flight) => {
                flight.setFlightDetails(await this.getFlightDetails(flight));
            }));
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

        const headers = {...Core.jsonHeaders, "accesstoken": this.getLoginData()["accessToken"]};
        const {content} = await request(Core.historicalDataUrl(flight.id, fileType, timestamp), {
            headers,
            cookies: this.__loginData["cookies"],
        });

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
     * @return {Promise<object>}
     */
    async getMostTracked() {
        const {content} = await request(Core.mostTrackedUrl, {headers: Core.jsonHeaders});
        return content;
    }

    /**
     * Return boundaries of volcanic eruptions and ash clouds impacting aviation.
     *
     * @return {Promise<object>}
     */
    async getVolcanicEruptions() {
        const {content} = await request(Core.volcanicEruptionDataUrl, {headers: Core.jsonHeaders});
        return content;
    }

    /**
     * Return all major zones on the globe.
     *
     * @return {object}
     */
    getZones() {
        const zones = {...Core.staticZones};
        delete zones.version;
        return zones;
    }

    /**
     * Return the search result.
     *
     * @param {string} query
     * @param {number} [limit=50]
     * @return {Promise<object>}
     */
    async search(query, limit = 50) {
        const {content} = await request(Core.searchDataUrl(query, limit), {headers: Core.jsonHeaders});

        const results = content["results"] ?? [];
        const countDict = content["stats"]?.["count"] ?? {};

        let index = 0;
        const data = {};

        for (const name in countDict) {
            if (!Object.prototype.hasOwnProperty.call(countDict, name)) {
                continue;
            }

            const count = countDict[name];
            data[name] = results.slice(index, index + count);
            index += count;
        }

        return data;
    }

    /**
     * Check if the user is logged into the FlightRadar24 account.
     *
     * @return {boolean}
     */
    isLoggedIn() {
        return this.__loginData !== null;
    }

    /**
     * Log in to a FlightRadar24 account.
     *
     * @param {string} user - Your email.
     * @param {string} password - Your password.
     * @return {Promise<undefined>}
     */
    async login(user, password) {
        const {content, statusCode, cookies} = await request(Core.userLoginUrl, {
            headers: Core.jsonHeaders,
            data: {"email": user, "password": password, "remember": "true", "type": "web"},
        });

        if (statusCode < 200 || statusCode >= 300 || !content["success"]) {
            throw new LoginError(
                typeof content === "object" ? content["message"] : "Your email or password is incorrect",
            );
        }

        this.__loginData = {"userData": content["userData"], "cookies": cookies};
    }

    /**
     * Log out of the FlightRadar24 account.
     *
     * @return {Promise<boolean>} - Return a boolean indicating that it successfully logged out of the server.
     */
    async logout() {
        if (this.__loginData === null) {
            return true;
        }

        const cookies = this.__loginData["cookies"];
        this.__loginData = null;

        const {statusCode} = await request(Core.userLogoutUrl, {headers: Core.jsonHeaders, cookies});
        return statusCode >= 200 && statusCode < 300;
    }

    /**
     * Set config for the Real Time Flight Tracker, used by getFlights() method.
     *
     * @param {FlightTrackerConfig} [flightTrackerConfig] - If null, set to the default config.
     * @param {object} [config={}] - Config as an JSON object
     * @return {undefined}
     */
    setFlightTrackerConfig(flightTrackerConfig = null, config = {}) {
        if (flightTrackerConfig !== null) {
            this.__flightTrackerConfig = flightTrackerConfig;
        }

        for (const key in config) {
            if (Object.prototype.hasOwnProperty.call(config, key)) {
                this.__flightTrackerConfig[key] = config[key].toString();
            }
        }
    }
}

module.exports = FlightRadar24API;
