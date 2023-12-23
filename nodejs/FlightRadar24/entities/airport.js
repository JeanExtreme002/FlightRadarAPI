const Entity = require("./entity");


const proxyHandler = {
    get: function(target, name) {
        return name in target? target[name] : target.__rawInformation[name];
    },
};


/**
 * Airport representation.
 */
class Airport extends Entity {
    /**
     * Constructor of Airport class.
     *
     * @param {object} [info] - Basic information about the airport
     * @param {object} [details] - Dictionary with more information about the airport
     */
    constructor(info = {}, details = {}) {
        super();

        if (info && Object.keys(info).length > 0) {
            this.__setPosition(info["lat"], info["lon"]);
            this.__initializeWithBasicInfo(info);
        }

        if (details && Object.keys(details).length > 0) {
            this.__setPosition(details["position"]["latitude"], details["position"]["longitude"]);
            this.__initializeWithDetails(details);
        }

        this.__rawInformation = Object.assign(info, details);

        return new Proxy(this, proxyHandler);
    }

    /**
     * Initialize instance with basic information about the airport.
     *
     * @param {object} info
     */
    __initializeWithBasicInfo(info) {
        this.altitude = info["alt"];

        this.name = info["name"];
        this.icao = info["icao"];
        this.iata = info["iata"];

        this.country = info["country"];
    }

    /**
     * Initialize instance with detailed information about the airport.
     *
     * @param {object} details
     */
    __initializeWithDetails(details) {
        this.altitude = details["position"]["altitude"];

        this.name = details["name"];
        this.icao = details["code"]["icao"];
        this.iata = details["code"]["iata"];

        // Location information.
        const position = details["position"];

        this.country = position["country"]["name"];
        this.countryCode = this.__getInfo(position["country"]?.["code"]);
        this.city = this.__getInfo(position["region"]?.["city"]);

        // Timezone information.
        const timezone = details["timezone"];

        this.timezoneName = this.__getInfo(timezone?.["name"]);
        this.timezoneOffset = this.__getInfo(timezone?.["offset"]);
        this.timezoneOffsethours = this.__getInfo(timezone?.["offsetHours"]);
        this.timezoneAbbr = this.__getInfo(timezone?.["abbr"]);
        this.timezoneAbbrName = this.__getInfo(timezone?.["abbrName"]);

        // Other information.
        this.visible = this.__getInfo(details["visible"]);
        this.website = this.__getInfo(details["website"]);
    }
}

module.exports = Airport;
