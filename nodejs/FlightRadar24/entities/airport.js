const Entity = require("./entity");


/**
 * Airport representation.
 */
class Airport extends Entity {
    /**
     * Constructor of Airport class.
     *
     * The parameters below are optional. You can just create an Airport instance with no information
     * and use the setAirportDetails(...) method for having an instance with detailed information.
     *
     * @param {object} [basicInfo] - Basic information about the airport received from FlightRadar24
     * @param {object} [info] - Dictionary with more information about the airport received from FlightRadar24
     */
    constructor(basicInfo = {}, info = {}) {
        super();

        if (basicInfo && Object.keys(basicInfo).length > 0) {
            this.__setPosition(basicInfo["lat"], basicInfo["lon"]);
            this.__initializeWithBasicInfo(basicInfo);
        }

        if (info && Object.keys(info).length > 0) {
            this.__setPosition(info["position"]["latitude"], info["position"]["longitude"]);
            this.__initializeWithInfo(info);
        }
    }

    /**
     * Initialize instance with basic information about the airport.
     *
     * @param {object} basicInfo
     */
    __initializeWithBasicInfo(basicInfo) {
        this.altitude = basicInfo["alt"];

        this.name = basicInfo["name"];
        this.icao = basicInfo["icao"];
        this.iata = basicInfo["iata"];

        this.country = basicInfo["country"];
    }

    /**
     * Initialize instance with extra information about the airport.
     *
     * @param {object} info
     */
    __initializeWithInfo(info) {
        this.altitude = info["position"]["altitude"];

        this.name = info["name"];
        this.icao = info["code"]["icao"];
        this.iata = info["code"]["iata"];

        // Location information.
        const position = info["position"];

        this.country = position["country"]["name"];
        this.countryCode = this.__getInfo(position["country"]?.["code"]);
        this.city = this.__getInfo(position["region"]?.["city"]);

        // Timezone information.
        const timezone = info["timezone"];

        this.timezoneName = this.__getInfo(timezone?.["name"]);
        this.timezoneOffset = this.__getInfo(timezone?.["offset"]);
        this.timezoneOffsetHours = this.__getInfo(timezone?.["offsetHours"]);
        this.timezoneAbbr = this.__getInfo(timezone?.["abbr"]);
        this.timezoneAbbrName = this.__getInfo(timezone?.["abbrName"]);

        // Other information.
        this.visible = this.__getInfo(info["visible"]);
        this.website = this.__getInfo(info["website"]);
    }

    /**
     * Set airport details to the instance. Use FlightRadar24API.getAirportDetails(...) method to get it.
     *
     * @param {object} airportDetails
     */
    setAirportDetails(airportDetails) {
        // Get airport data.
        const airport = airportDetails?.["airport"]?.["pluginData"];

        // Get information about the airport.
        const details = airport?.["details"];

        // Get location information.
        const position = details?.["position"];
        const code = details?.["code"];
        const country = position?.["country"];
        const region = position?.["region"];

        // Get reviews of the airport.
        const flightDiary = airport?.["flightdiary"];
        const ratings = flightDiary?.["ratings"];

        // Get schedule information.
        const schedule = airport?.["schedule"];

        // Get timezone information.
        const timezone = details?.["timezone"];

        // Get aircraft count.
        const aircraftCount = airport?.["aircraftCount"];
        const aircraftOnGround = aircraftCount?.["onGround"];

        // Get URLs for more information about the airport.
        const urls = details?.["url"];

        // Basic airport information.
        this.name = this.__getInfo(details?.["name"]);
        this.iata = this.__getInfo(code?.["iata"]);
        this.icao = this.__getInfo(code?.["icao"]);
        this.altitude = this.__getInfo(position?.["elevation"]);
        this.latitude = this.__getInfo(position?.["latitude"]);
        this.longitude = this.__getInfo(position?.["longitude"]);

        // Airport location.
        this.country = this.__getInfo(country?.["name"]);
        this.country_code = this.__getInfo(country?.["code"]);
        this.country_id = this.__getInfo(country?.["id"]);
        this.city = this.__getInfo(region?.["city"]);

        // Airport timezone.
        this.timezoneAbbr = this.__getInfo(timezone?.["abbr"]);
        this.timezoneAbbrName = this.__getInfo(timezone?.["abbrName"]);
        this.timezoneName = this.__getInfo(timezone?.["name"]);
        this.timezoneOffset = this.__getInfo(timezone?.["offset"]);

        if (typeof this.timezoneOffset === "number") {
            this.timezoneOffsetHours = Math.trunc(this.timezoneOffset / 60 / 60);
            this.timezoneOffsetHours = this.timezoneOffsetHours + ":00";
        }
        else {
            this.timezoneOffsetHours = this.__getInfo(None);
        }

        // Airport reviews.
        this.reviewsUrl = flightDiary?.["url"];

        if (this.reviewsUrl && typeof this.reviewsUrl === "string") {
            this.reviewsUrl = "https://www.flightradar24.com" + this.reviewsUrl;
        }
        else {
            this.reviewsUrl = this.__getInfo(this.reviewsUrl);
        }

        this.reviews = this.__getInfo(flightDiary?.["reviews"]);
        this.evaluation = this.__getInfo(flightDiary?.["evaluation"]);

        this.averageRating = this.__getInfo(ratings?.["avg"]);
        this.totalRating = this.__getInfo(ratings?.["total"]);

        // Weather information.
        this.weather = this.__getInfo(airport?.["weather"], {});

        // Runway information.
        this.runways = this.__getInfo(airport?.["runways"], []);

        // Aircraft count information.
        this.aircraftOnGround = this.__getInfo(aircraftOnGround?.["total"]);
        this.aircraftVisibleOnGround = this.__getInfo(aircraftOnGround?.["visible"]);

        // Schedule information.
        this.arrivals = this.__getInfo(schedule?.["arrivals"], {});
        this.departures = this.__getInfo(schedule?.["departures"], {});

        // Link for the homepage and more information
        this.website = this.__getInfo(urls?.["homepage"]);
        this.wikipedia = this.__getInfo(urls?.["wikipedia"]);

        // Other information.
        this.visible = this.__getInfo(details?.["visible"]);
        this.images = this.__getInfo(details?.["airportImages"], {});
    }
}

module.exports = Airport;
