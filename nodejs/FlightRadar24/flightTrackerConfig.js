const proxyHandler = {
    set: function(target, key, value) {
        if (!target.hasOwnProperty(key)) {
            throw new Error("Unknown option: '" + key + "'");
        }
        if ((typeof value !== "number") && (!isNumeric(value))) {
            throw new Error("Value must be a decimal. Got '" + key + "'");
        }
        target[key] = value.toString();
    },
};

function isNumeric(string) {
    for (let index = 0; index < string.length; index++) {
        if (!"0123456789".includes(string[index])) {
            return false;
        }
    }
    return true;
}


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

    /**
     * Constructor of FlighTrackerConfig class.
     *
     * @param {object} data
     */
    constructor(data) {
        for (const key in data) {
            const value = data[key];

            if (this.hasOwnProperty(key) && (typeof value === "number" || isNumeric(value))) {
                this[key] = value;
            }
        }
        return new Proxy(this, proxyHandler);
    }
}

module.exports = FlightTrackerConfig;
