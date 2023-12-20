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
    air = "1"
    vehicles = "1";
    estimated = "1";
    maxage = "14400";
    gliders = "1";
    stats = "1";
    limit = "5000";

    __proxyHandler = {
        set: function(target, name) {
            return;  // Do nothing.
        }
    };

    constructor(data) {
        for (let key in data) {
            const value = data[key];

            if (this.hasOwnProperty(key) && typeof(value) == "string") {
                this[key] = value;
            }
        }
        return new Proxy(this, this.__proxyHandler);
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
        this.__flight_tracker_config = new FlightTrackerConfig();
        this.__login_data = null;
    }

    /**
     * Return a list with all airlines.
     */
    async get_airlines() {
        const response = new APIRequest(Core.airlines_data_url, null, Core.json_headers);
        await response.receive();

        return (await response.get_content())["rows"];
    }
    
    /**
     * Download the logo of an airline from FlightRadar24 and return it as bytes.
     * 
     * @param {string} iata
     * @param {string} icao
     */
    async get_airline_logo(iata, icao) {
        iata = iata.toUpperCase();
        icao = icao.toUpperCase();

        let first_logo_url = Core.airline_logo_url.split("{}");
        first_logo_url = first_logo_url[0] + iata + first_logo_url[1] + icao + first_logo_url[2];

        // Try to get the image by the first URL option.
        let response = new APIRequest(first_logo_url, null, Core.image_headers, null, null, [403,]);
        await response.receive();

        let status_code = response.get_status_code();

        if (!status_code.toString().startsWith("4")) {
            const split_url = first_logo_url.split(".");
            return [(await response.get_content()), split_url[split_url.length]];
        }

        // Get the image by the second airline logo URL.
        const second_logo_url = Core.alternative_airline_logo_url.replace("{}", icao);

        response = new APIRequest(second_logo_url, null, Core.image_headers);
        await response.receive();

        status_code = response.get_status_code();

        if (!status_code.toString().startsWith("4")) {
            return [(await response.get_content()), second_logo_url.split(".")[-1]];
        }
    }

    /**
     * Return information about a specific airport.
     * 
     * @param {string} code - ICAO or IATA of the airport
     * @return {Airport}
     */
    async get_airport(code) {
        const response = new APIRequest(Core.airport_data_url.replace("{}", code), null, Core.json_headers);
        await response.receive();

        return new Airport({}, (await response.get_content())["details"]);
    }

    /**
     * Return the airport details from FlightRadar24.
     * 
     * @param {string} code - ICAO or IATA of the airport
     * @param {number} flight_limit - Limit of flights related to the airport
     * @param {number} page - Page of result to display
     */
    async get_airport_details(code, flight_limit = 100, page = 1) {
        const request_params = {"format": "json"};

        if (this.__login_data != null) {
            request_params["token"] = this.__login_data["cookies"]["_frPl"];
        }

        // Insert the method parameters into the dictionary for the request.
        request_params["code"] = code;
        request_params["limit"] = flight_limit;
        request_params["page"] = page

        // Request details from the FlightRadar24.
        const response = new APIRequest(Core.api_airport_data_url, request_params, Core.json_headers, null, null, [400,]);
        await response.receive();
        
        const content = await response.get_content();

        if (response.get_status_code() == 400 && typeof(content) == "object" && content["errors"]) {
            throw Error(content["errors"]["errors"]["parameters"]["limit"]["notBetween"]);
        }
        return content["result"]["response"];
    }

    /**
     * Return a list with all airports.
     */
    async get_airports() {
        const response = new APIRequest(Core.airports_data_url, null, Core.json_headers);
        await response.receive();

        const content = await response.get_content();
        const airports = [];

        for (const airport_data of content["rows"]) {
            const airport = new Airport(airport_data);
            airports.push(airport);
        }
        return airports;
    }

    /**
     * Convert coordinate dictionary to a string "y1, y2, x1, x2".
     * 
     * @param {object} zone - Dictionary containing the following keys: tl_y, tl_x, br_y, br_x
     * @returns {string}
     */
    get_bounds(zone) {
        return "" + zone["tl_y"] + "," + zone["br_y"] + "," + zone["tl_x"] + "," + zone["br_x"];
    }

    /**
     * Convert a point coordinate and a radius to a string "y1, y2, x1, x2".
     * 
     * @param {number} latitude - Latitude of the point
     * @param {number} longitude - Longitude of the point
     * @param {number} radius - Radius in meters to create area around the point
     * @returns {string}
     */
    get_bounds_by_point(latitude, longitude, radius) {
        const half_side_in_km = Math.abs(radius) / 1000;

        Math.rad2deg = (x) => x * (180 / Math.PI);
        Math.radians = (x) => x * (Math.PI / 180);

        const lat = Math.radians(latitude);
        const lon = Math.radians(longitude);

        const approx_earth_radius = 6371;
        const hypotenuse_distance = Math.sqrt(2 * (Math.pow(half_side_in_km, 2)));

        const lat_min = Math.asin(
            Math.sin(lat) * Math.cos(hypotenuse_distance / approx_earth_radius)
            + Math.cos(lat)
            * Math.sin(hypotenuse_distance / approx_earth_radius)
            * Math.cos(225 * (Math.PI / 180)),
        )
        const lon_min = lon + Math.atan2(
            Math.sin(225 * (Math.PI / 180))
            * Math.sin(hypotenuse_distance / approx_earth_radius)
            * Math.cos(lat),
            Math.cos(hypotenuse_distance / approx_earth_radius)
            - Math.sin(lat) * Math.sin(lat_min),
        )

        const lat_max = Math.asin(
            Math.sin(lat) * Math.cos(hypotenuse_distance / approx_earth_radius)
            + Math.cos(lat)
            * Math.sin(hypotenuse_distance / approx_earth_radius)
            * Math.cos(45 * (Math.PI / 180)),
        )
        const lon_max = lon + Math.atan2(
            Math.sin(45 * (Math.PI / 180))
            * Math.sin(hypotenuse_distance / approx_earth_radius)
            * Math.cos(lat),
            Math.cos(hypotenuse_distance / approx_earth_radius)
            - Math.sin(lat) * Math.sin(lat_max),
        )

        zone = {
            "tl_y": Math.rad2deg(lat_max),
            "br_y": Math.rad2deg(lat_min),
            "tl_x": Math.rad2deg(lon_min),
            "br_x": Math.rad2deg(lon_max)
        }
        return this.get_bounds(zone);
    }

    /**
     * Download the flag of a country from FlightRadar24 and return it as bytes.
     * 
     * @param {string} - Country name 
     */
    async get_country_flag(country) {
        const flag_url = Core.country_flag_url.replace("{}", country.toLowerCase().replace(" ", "-"));
        const headers = {... Core.image_headers};
        
        if (headers.hasOwnProperty("origin")) {
            delete headers["origin"];  // Does not work for this request.
        }

        const response = new APIRequest(flag_url, null, headers);
        await response.receive();

        const status_code = response.get_status_code();

        if (!status_code.toString().startsWith("4")) {
            const split_url = flag_url.split(".");
            return [(await response.get_content()), split_url[split_url.length]];
        }
    }

    /**
     * Return the flight details from Data Live FlightRadar24.
     * 
     * @param {Flight} flight - A Flight instance.
     */
    async get_flight_details(flight) {
        const response = new APIRequest(Core.flight_data_url.replace("{}", flight.id), null, Core.json_headers);
        await response.receive();

        return (await response.get_content());
    }
    
    /**
     * Return a list of flights. See more options at set_flight_tracker_config() method.
     * 
     * @param {string} airline - The airline ICAO. Ex: "DAL"
     * @param {string} bounds - Coordinates (y1, y2 ,x1, x2). Ex: "75.78,-75.78,-427.56,427.56"
     * @param {string} registration - Aircraft registration
     * @param {string} aircraft_type - Aircraft model code. Ex: "B737"
     * @param {boolean} details -  If true, it returns flights with detailed information
     */
    async get_flights(airline = null, bounds = null, registration = null, aircraft_type = null, details = false) {
        const request_params = this.__flight_tracker_config.asdict();

        if (this.__login_data != null) {
            request_params["enc"] = self.__login_data["cookies"]["_frPl"];
        }

        // Insert the method parameters into the dictionary for the request.
        if (airline != null) {
            request_params["airline"] = airline;
        }
        if (bounds != null) {
            request_params["bounds"] = bounds.replace(",", "%2C");
        }
        if (registration != null) {
            request_params["reg"] = registration;
        }
        if (aircraft_type != null) {
            request_params["type"] = aircraft_type;
        }

        // Get all flights from Data Live FlightRadar24.
        const response = new APIRequest(Core.real_time_flight_tracker_data_url, request_params, Core.json_headers);
        await response.receive();

        const content = await response.get_content();
        const flights = [];

        function isNumeric(string) {
            for (let index = 0; index < string.length; index++) {
                if (!"0123456789".includes(string[index])) {
                    return false;
                }
            }
            return true;
        }

        for (const flight_id in content) {
            const flight_info = content[flight_id];

            // Get flights only.
            if (!isNumeric(flight_id[0])) {
                continue;
            }

            const flight = new Flight(flight_id, flight_info);
            flights.push(flight);

            // Set flight details.
            if (details) {
                const flight_details = await this.get_flight_details(flight_id);
                flight.set_flight_details(flight_details);
            }
        }

        return flights;
    }

    /**
     * Return a copy of the current config of the Real Time Flight Tracker, used by get_flights() method.
     * 
     * @returns {FlightTrackerConfig}
     */
    async get_flight_tracker_config() {
        return new FlightTrackerConfig(this.__flight_tracker_config.asdict());
    }

    /**
     * Return the user data.
     */
    get_login_data() {
        if (!self.is_logged_in()) {
            throw new LoginError("You must log in to your account.");
        }
        return [... this.__login_data["userData"]];
    }

    /**
     * Return all major zones on the globe.
     */
    async get_zones() {
        const response = new APIRequest(Core.zones_data_url, null, Core.json_headers);
        await response.receive();

        let zones = await response.get_content();

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
        const response = new APIRequest(Core.search_data_url.replace("{}", query), null, Core.json_headers);
        await response.receive();

        const content = await response.get_content();

        let results = content["results"];
        results = results == null ? [] : results;

        let stats = content["stats"];
        stats = stats == null ? {} : stats;

        let count_dict = stats["count"];
        count_dict = count_dict == null ? {} : count_dict;

        let index = 0;
        let counted_total = 0;
            
        const data = {};

        for (const name in count_dict) {
            const count = count_dict[name];

            data[name] = [];

            while (index < (counted_total + count) && (index < results.length)) {
                data[name].push(results[index]);
                index++;
            }
            counted_total += count;
        }

        return data;
    }

    /**
     * Return the most tracked data.
     */
    async get_most_tracked() {
        const response = new APIRequest(Core.most_tracked_url, null, Core.json_headers);
        await response.receive();

        return await response.get_content();
    }
    
    /**
     * Check if the user is logged into the FlightRadar24 account.
     * 
     * @returns {boolean}
     */
    is_logged_in() {
        return this.__login_data != null;
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
            "type": "web"
        }

        const response = new APIRequest(Core.user_login_url, null, Core.json_headers, data);
        await response.receive();

        const status_code = response.get_status_code();
        const content = await response.get_content();

        if (!status_code.toString().startsWith("2") || !content["success"]) {
            if (typeof(content) == "object") {
                throw new LoginError(content["message"]);
            }
            else {
                throw new LoginError("Your email or password is incorrect");
            }
        }

        this.__login_data = {
            "userData": content["userData"],
            "cookies": response.get_cookies(),
        }
    }

    /**
     * Log out of the FlightRadar24 account.
     * 
     * @returns {boolean} - Return a boolean indicating that it successfully logged out of the server. 
     */
    async logout() {
        if (this.__login_data == null) {
            return true;
        }

        const cookies = this.__login_data["cookies"];
        this.__login_data = null;

        const response = new APIRequest(
            Core.user_login_url, params = null, 
            headers = Core.json_headers, 
            data = null, cookies = cookies
        );
        await response.receive();

        return status_code.toString().startsWith("2");
    }

    /**
     * Set config for the Real Time Flight Tracker, used by get_flights() method.
     * 
     * @param {FlightTrackerConfig} flight_tracker_config - If null, set to default config.
     */
    async set_flight_tracker_config(flight_tracker_config = null, data = {}) {
        if (flight_tracker_config != null) {
            this.__flight_tracker_config = flight_tracker_config;
        }

        const current_config_dict = this.__flight_tracker_config.asdict();

        function isNumeric(string) {
            for (let index = 0; index < string.length; index++) {
                if (!"0123456789".includes(string[index])) {
                    return false;
                }
            }
            return true;
        }

        for (const key in config) {
            const value = config[key].toString();

            if (!current_config_dict.hasOwnProperty(key)) {
                throw new Error("Unknown option: '" + key + "'");
            }

            if (!isNumeric(value)) {
                throw new Error("Value must be a decimal. Got '" + key + "'");
            }
            
            current_config_dict[key] = value;
        }

        this.__flight_tracker_config = new FlightTrackerConfig(current_config_dict);
    }
}

module.exports = {FlightRadar24API: FlightRadar24API, FlightTrackerConfig: FlightTrackerConfig};