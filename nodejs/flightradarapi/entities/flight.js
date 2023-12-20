const Entity = require("./entity");


class Flight extends Entity {
    /**
     * Flight representation.
     */
   
    static __default_text = "N/A";

    /**
     * Constructor of Flight class.
     * 
     * @param {*} flight_id - The flight ID specifically used by FlightRadar24
     * @param {*} info - Dictionary with received data from FlightRadar24
     */
    constructor(flight_id, info) {
        super();
        
        this.__set_position(this.__getInfo(info[1]), this.__getInfo(info[2]));

        this.id = flight_id;
        this.icao_24bit = this.__getInfo(info[0]);
        this.heading = this.__getInfo(info[3]);
        this.altitude = this.__getInfo(info[4]);
        this.ground_speed = this.__getInfo(info[5]);
        this.squawk = this.__getInfo(info[6]);
        this.aircraft_code = this.__getInfo(info[8]);
        this.registration = this.__getInfo(info[9]);
        this.time = this.__getInfo(info[10]);
        this.origin_airport_iata = this.__getInfo(info[11]);
        this.destination_airport_iata = this.__getInfo(info[12]);
        this.number = this.__getInfo(info[13]);
        this.airline_iata = this.__getInfo(info[13].slice(0, 2));
        this.on_ground = this.__getInfo(info[14]);
        this.vertical_speed =this.__getInfo(info[15]);
        this.callsign = this.__getInfo(info[16]);
        this.airline_icao = this.__getInfo(info[18]);
    }

    /**
     * Check one or more flight information.
     *
     * You can use the prefix "max_" or "min_" in the parameter
     * to compare numeric data with ">" or "<".
     *
     * Example: check_info({min_altitude: 6700}, {max_altitude: 13000}, {icao: "THY"})
     * @param {object} info 
     * @returns {boolean}
     */
    check_info(info) {

        const comparisonFunctions = {"max": Math.max, "min": Math.min};

        for (let key in info) {
            let prefix = key.slice(0, 4);
            let value = info[key];
            
            // Separate the comparison prefix if it exists.
            if ((prefix === "max_") || (prefix === "min_")) {
                key = key.split("_", 1)[1];  
                prefix = prefix.slice(0, -1);
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
     * @returns {string}
     */
    get_altitude() {
        return this.altitude.toString() + " ft";
    }

    /**
     * Return the formatted flight level, with the unit of measure.
     * @returns {string}
     */
    get_flight_level() {
        if (this.altitude >= 10000) {
            return this.altitude.toString().slice(0, 3) + " FL";
        }
        return this.get_altitude();
    }

    /**
     * Return the formatted ground speed, with the unit of measure.
     * @returns {string}
     */
    get_ground_speed() {
        const sufix = this.ground_speed > 1 ? "s" : "";
        return this.ground_speed.toString() + " kt" + sufix;
    }

    /**
     * Return the formatted heading, with the unit of measure.
     * @returns {string}
     */
    get_heading() {
        return this.heading.toString() + "°";
    }

    /**
     * Return the formatted vertical speed, with the unit of measure.
     * @returns {string}
     */
    get_vertical_speed() {
        return this.vertical_speed.toString() + " fpm";
    }

    /**
     * Set flight details to the instance. Use FlightRadar24API.get_flight_details(...) method to get it.
     * @param {object} flight_details
     */
    set_flight_details(flight_details) {
        flight_details = this.__createGetterMethodFor(flight_details);

        // Get aircraft data.
        const aircraft = this.__getDetails(flight_details.get("aircraft"));

        // Get airline data.
        const airline = this.__getDetails(flight_details.get("airline"));

        // Get airport data.
        const airport = this.__getDetails(flight_details.get("airport"));

        // Get destination data.
        const dest_airport = this.__getDetails(airport.get("destination"));
        const dest_airport_code = this.__getDetails(dest_airport.get("code"));
        const dest_airport_info = this.__getDetails(dest_airport.get("info"));
        const dest_airport_position = this.__getDetails(dest_airport.get("position"));
        const dest_airport_country = this.__getDetails(dest_airport_position.get("country"));
        const dest_airport_timezone = this.__getDetails(dest_airport.get("timezone"));

        // Get origin data.
        const orig_airport = this.__getDetails(airport.get("origin"));
        const orig_airport_code = this.__getDetails(orig_airport.get("code"));
        const orig_airport_info = this.__getDetails(orig_airport.get("info"));
        const orig_airport_position = this.__getDetails(orig_airport.get("position"));
        const orig_airport_country = this.__getDetails(orig_airport_position.get("country"));
        const orig_airport_timezone = this.__getDetails(orig_airport.get("timezone"));

        // Get flight history.
        const history = this.__getDetails(flight_details.get("flightHistory"));

        // Get flight status.
        const status = this.__getDetails(flight_details.get("status"));

        // Aircraft information.
        this.aircraft_age = this.__getInfo(aircraft.get("age"));
        this.aircraft_country_id = this.__getInfo(aircraft.get("countryId"));
        this.aircraft_history = history.get("aircraft", list());
        this.aircraft_images = aircraft.get("images", list());
        this.aircraft_model = this.__getInfo(this.__getDetails(aircraft.get("model")).get("text"));

        // Airline information.
        this.airline_name = this.__getInfo(airline.get("name"));
        this.airline_short_name = this.__getInfo(airline.get("short"));

        // Destination airport position.
        this.destination_airport_altitude = this.__getInfo(dest_airport_position.get("altitude"));
        this.destination_airport_country_code = this.__getInfo(dest_airport_country.get("code"));
        this.destination_airport_country_name = this.__getInfo(dest_airport_country.get("name"));
        this.destination_airport_latitude = this.__getInfo(dest_airport_position.get("latitude"));
        this.destination_airport_longitude = this.__getInfo(dest_airport_position.get("longitude"));

        // Destination airport information.
        this.destination_airport_icao = this.__getInfo(dest_airport_code.get("icao"));
        this.destination_airport_baggage = this.__getInfo(dest_airport_info.get("baggage"));
        this.destination_airport_gate = this.__getInfo(dest_airport_info.get("gate"));
        this.destination_airport_name = this.__getInfo(dest_airport.get("name"));
        this.destination_airport_terminal = this.__getInfo(dest_airport_info.get("terminal"));
        this.destination_airport_visible = this.__getInfo(dest_airport.get("visible"));
        this.destination_airport_website = this.__getInfo(dest_airport.get("website"));

        // Destination airport timezone.
        this.destination_airport_timezone_abbr = this.__getInfo(dest_airport_timezone.get("abbr"));
        this.destination_airport_timezone_abbr_name = this.__getInfo(dest_airport_timezone.get("abbrName"));
        this.destination_airport_timezone_name = this.__getInfo(dest_airport_timezone.get("name"));
        this.destination_airport_timezone_offset = this.__getInfo(dest_airport_timezone.get("offset"));
        this.destination_airport_timezone_offsetHours = this.__getInfo(dest_airport_timezone.get("offsetHours"));

        // Origin airport position.
        this.origin_airport_altitude = this.__getInfo(orig_airport_position.get("altitude"));
        this.origin_airport_country_code = this.__getInfo(orig_airport_country.get("code"));
        this.origin_airport_country_name = this.__getInfo(orig_airport_country.get("name"));
        this.origin_airport_latitude = this.__getInfo(orig_airport_position.get("latitude"));
        this.origin_airport_longitude = this.__getInfo(orig_airport_position.get("longitude"));

        // Origin airport information.
        this.origin_airport_icao = this.__getInfo(orig_airport_code.get("icao"));
        this.origin_airport_baggage = this.__getInfo(orig_airport_info.get("baggage"));
        this.origin_airport_gate = this.__getInfo(orig_airport_info.get("gate"));
        this.origin_airport_name = this.__getInfo(orig_airport.get("name"));
        this.origin_airport_terminal = this.__getInfo(orig_airport_info.get("terminal"));
        this.origin_airport_visible = this.__getInfo(orig_airport.get("visible"));
        this.origin_airport_website = this.__getInfo(orig_airport.get("website"));

        // Origin airport timezone.
        this.origin_airport_timezone_abbr = this.__getInfo(orig_airport_timezone.get("abbr"));
        this.origin_airport_timezone_abbr_name = this.__getInfo(orig_airport_timezone.get("abbrName"));
        this.origin_airport_timezone_name = this.__getInfo(orig_airport_timezone.get("name"));
        this.origin_airport_timezone_offset = this.__getInfo(orig_airport_timezone.get("offset"));
        this.origin_airport_timezone_offsetHours = this.__getInfo(orig_airport_timezone.get("offsetHours"));

        // Flight status.
        this.status_icon = this.__getInfo(status.get("icon"));
        this.status_text = this.__getInfo(status.get("text"));

        // Time details.
        this.time_details = this.__getDetails(flight_details.get("time"));

        // Flight trail.
        this.trail = flight_details.get("trail", list());
    }
}

module.exports = Flight;
