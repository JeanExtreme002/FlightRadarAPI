/**
 * Check if the string is an integer
 *
 * @param {string} text
 * @return {boolean}
 */
function isNumeric(text) {
    if (text.length === 0) {
        return false;
    }

    for (let index = 0; index < text.length; index++) {
        if (!"0123456789".includes(text[index])) {
            return false;
        }
    }
    return true;
}

module.exports = {isNumeric};
