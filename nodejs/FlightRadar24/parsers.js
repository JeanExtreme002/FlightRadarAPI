const {JSDOM} = require("jsdom");
const Airport = require("./entities/airport");

/**
 * Parse the airlines listing HTML page into a list of airline objects.
 *
 * @param {string} html
 * @return {Array<object>}
 */
function parseAirlinesHtml(html) {
    const dom = new JSDOM(html);
    const tbody = dom.window.document.querySelector("tbody");

    if (!tbody) {
        return [];
    }

    const airlines = [];

    for (const tr of tbody.querySelectorAll("tr")) {
        const tdNotranslate = tr.querySelector("td.notranslate");

        if (!tdNotranslate) {
            continue;
        }

        const aElement = tdNotranslate.querySelector("a[href^='/data/airlines']");

        if (!aElement) {
            continue;
        }

        const airlineName = aElement.textContent.trim();

        if (airlineName.length < 2) {
            continue;
        }

        const tdElements = tr.querySelectorAll("td");
        let iata = null;
        let icao = null;

        if (tdElements.length >= 4) {
            const codesText = tdElements[3].textContent.trim();

            if (codesText.includes(" / ")) {
                const parts = codesText.split(" / ");

                if (parts.length === 2) {
                    iata = parts[0].trim();
                    icao = parts[1].trim();
                }
            }
            else if (codesText.length === 2) {
                iata = codesText;
            }
            else if (codesText.length === 3) {
                icao = codesText;
            }
        }

        let nAircrafts = null;

        if (tdElements.length >= 5) {
            const aircraftsText = tdElements[4].textContent.trim();

            if (aircraftsText) {
                nAircrafts = parseInt(aircraftsText.split(" ")[0].trim(), 10);
            }
        }

        airlines.push({"Name": airlineName, "ICAO": icao, "IATA": iata, "n_aircrafts": nAircrafts});
    }

    return airlines;
}

/**
 * Parse the airports listing HTML page for a country into a list of Airport instances.
 *
 * @param {string} html
 * @param {string} countryHref - Full URL used to fetch the page (used to derive the display name)
 * @return {Array<Airport>}
 */
function parseAirportsHtml(html, countryHref) {
    const dom = new JSDOM(html);
    const tbody = dom.window.document.querySelector("tbody");

    if (!tbody) {
        return [];
    }

    const countryDisplayName = countryHref.split("/").pop().replace(/-/g, " ")
        .split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

    const airports = [];

    for (const tr of tbody.querySelectorAll("tr")) {
        const aElements = tr.querySelectorAll("a[data-iata][data-lat][data-lon]");

        if (aElements.length === 0) {
            continue;
        }

        const aElement = aElements[0];
        let icao = "";
        let iata = aElement.getAttribute("data-iata") || "";
        const latitude = aElement.getAttribute("data-lat") || "";
        const longitude = aElement.getAttribute("data-lon") || "";
        let namePart = aElement.textContent.trim();

        const smallElement = aElement.querySelector("small");

        if (smallElement) {
            let codesText = smallElement.textContent.trim();
            codesText = codesText.replace(/^\(/, "").replace(/\)$/, "").trim();
            namePart = namePart.replace(smallElement.textContent, "").replace(/\(\)/, "").trim();

            if (codesText.includes("/")) {
                const codes = codesText.split("/");
                const code1 = codes[0].trim();
                const code2 = codes[1].trim();

                if (code1.length === 3 && code2.length === 4) {
                    iata = code1;
                    icao = code2;
                }
                else if (code1.length === 4 && code2.length === 3) {
                    iata = code2;
                    icao = code1;
                }
            }
            else if (codesText.length === 3) {
                iata = codesText;
            }
            else if (codesText.length === 4) {
                icao = codesText;
            }
        }

        airports.push(new Airport({
            "name": namePart,
            "icao": icao,
            "iata": iata,
            "lat": latitude ? parseFloat(latitude) : 0.0,
            "lon": longitude ? parseFloat(longitude) : 0.0,
            "alt": null,
            "country": countryDisplayName,
        }));
    }

    return airports;
}

module.exports = {parseAirlinesHtml, parseAirportsHtml};
