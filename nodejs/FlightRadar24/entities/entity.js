class Entity {
    /**
     * Representation of a real entity, at some location.
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

    __createGetterMethodFor(target, recursive = true) {
        function getter(x, defaultValue = null) {
            let value = defaultValue;

            if (this.hasOwnProperty(x)) {
                value = this[x];
            }

            if (recursive && (value != null && typeof value === "object")) {
                value.get = getter;
            }
            return value;
        }

        target.get = getter;
        return target;
    }

    __getDetails(data) {
        if (data == null) {
            data = {};
        }
        return this.__createGetterMethodFor(data);
    }

    __getInfo(info) {
        return (info || info === 0) && (info !== this.__defaultText) ? info : this.__defaultText;
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

        return Math.acos(
            Math.sin(lat1) * Math.sin(lat2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1),
        ) * 6371;
    }
}

module.exports = Entity;
