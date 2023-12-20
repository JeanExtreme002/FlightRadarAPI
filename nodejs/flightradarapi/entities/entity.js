class Entity {
    /**
     * Representation of a real entity, at some location.
     *
     * @param {number} latitude
     * @param {number} longitude
     */
    constructor(latitude=null, longitude=null) {
        this.__set_position(latitude, longitude);
    }

    __set_position(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    __createGetterMethodFor(target, recursive = true) {
        function getter(x, defaultValue = null) {
            let value = defaultValue;

            if (this.hasOwnProperty(x)) {
                value = this[x];
            }

            if (recursive && (value != null && typeof(value) === "object")) {
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
        return (info || info === 0) && (info !== this.__default_text) ? info : this.__default_text;
    }

    /**
     * Return the distance from another entity (in kilometers).
     *
     * @param {Entity} entity
     * @returns {number}
     */
    get_distance_from(entity) {
        let lat1 = Math.radians(this.latitude);
        let lon1 = Math.radians(this.longitude);

        let lat2 = Math.radians(entity.latitude);
        let lon2 = Math.radians(entity.longitude);

        return Math.acos(
            Math.sin(lat1) * Math.sin(lat2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
        ) * 6371;
    }
}

module.exports = Entity;