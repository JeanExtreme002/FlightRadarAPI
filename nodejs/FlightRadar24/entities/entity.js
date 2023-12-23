/**
 * Representation of a real entity, at some location.
 */
class Entity {
    static __defaultText = "N/A";

    /**
     * Constructor of Entity class.
     *
     * @param {number} latitude
     * @param {number} longitude
     */
    constructor(latitude = null, longitude = null) {
        this.__setPosition(latitude, longitude);
    }

    __setPosition(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    __getInfo(info, replaceBy = undefined) {
        replaceBy = replaceBy === undefined ? this.__defaultText : replaceBy;
        return (info || info === 0) && (info !== this.__defaultText) ? info : replaceBy;
    }

    /**
     * Return the distance from another entity (in kilometers).
     *
     * @param {Entity} entity
     * @return {number}
     */
    getDistanceFrom(entity) {
        Math.radians = (x) => x * (Math.PI / 180);

        const lat1 = Math.radians(this.latitude);
        const lon1 = Math.radians(this.longitude);

        const lat2 = Math.radians(entity.latitude);
        const lon2 = Math.radians(entity.longitude);

        return Math.acos(Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)) * 6371;
    }
}

module.exports = Entity;
