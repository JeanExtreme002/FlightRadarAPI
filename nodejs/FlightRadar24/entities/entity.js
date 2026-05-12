const { radians } = require("../util");

const DEFAULT_TEXT = "N/A";
const EARTH_RADIUS_KM = 6371;

/**
 * Representation of a real entity, at some location.
 */
class Entity {
    /**
     * Constructor of Entity class.
     *
     * @param {number} latitude
     * @param {number} longitude
     */
    constructor(latitude = null, longitude = null) {
        this.__setPosition(latitude, longitude);
    }

    /**
     * @param {number} latitude
     * @param {number} longitude
     */
    __setPosition(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    /**
     * @param {*} info
     * @param {*} [replaceBy]
     * @return {*}
     */
    __getInfo(info, replaceBy = DEFAULT_TEXT) {
        if (info === null || info === undefined || info === DEFAULT_TEXT) return replaceBy;
        return info;
    }

    /**
     * Return the distance from another entity (in kilometers).
     *
     * @param {Entity} entity
     * @return {number}
     */
    getDistanceFrom(entity) {
        if (this.latitude == null || this.longitude == null ||
            entity.latitude == null || entity.longitude == null) {
            throw new TypeError("Cannot calculate distance: one or both entities have no position.");
        }

        const lat1 = radians(this.latitude);
        const lon1 = radians(this.longitude);
        const lat2 = radians(entity.latitude);
        const lon2 = radians(entity.longitude);

        const angle = Math.acos(Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1));
        return angle * EARTH_RADIUS_KM;
    }
}

module.exports = Entity;
module.exports.DEFAULT_TEXT = DEFAULT_TEXT;
module.exports.EARTH_RADIUS_KM = EARTH_RADIUS_KM;
