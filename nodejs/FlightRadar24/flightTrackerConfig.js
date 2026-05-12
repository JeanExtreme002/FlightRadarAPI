const { isNumeric } = require("./util");


const proxyHandler = {
    set: function(target, key, value) {
        if (!Object.prototype.hasOwnProperty.call(target, key)) {
            throw new RangeError("Unknown option: '" + key + "'");
        }
        if ((typeof value !== "number") && (!isNumeric(value))) {
            throw new TypeError("Value must be a number. Got '" + value + "' for key '" + key + "'");
        }
        target[key] = value.toString();
        return true;
    },
};


/**
 * Data class with settings of the Real Time Flight Tracker.
 */
class FlightTrackerConfig {
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

    /**
     * Constructor of FlightTrackerConfig class.
     *
     * @param {object} [data={}]
     */
    constructor(data = {}) {
        for (const key in data) {
            if (!Object.prototype.hasOwnProperty.call(data, key)) { // guard-for-in
                continue;
            }
            const value = data[key];

            if (Object.prototype.hasOwnProperty.call(this, key) && (typeof value === "number" || isNumeric(value))) {
                this[key] = value;
            }
        }
        return new Proxy(this, proxyHandler);
    }
}

module.exports = FlightTrackerConfig;
