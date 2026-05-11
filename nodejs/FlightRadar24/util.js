/**
 * Check if a string represents a non-negative integer.
 *
 * @param {string} text
 * @return {boolean}
 */
function isNumeric(text) {
    return text.length > 0 && /^\d+$/.test(text);
}

/**
 * Convert degrees to radians.
 *
 * @param {number} x
 * @return {number}
 */
const radians = (x) => x * (Math.PI / 180);

/**
 * Convert radians to degrees.
 *
 * @param {number} x
 * @return {number}
 */
const rad2deg = (x) => x * (180 / Math.PI);

module.exports = { isNumeric, radians, rad2deg };
