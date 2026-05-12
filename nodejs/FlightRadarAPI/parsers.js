const { parse } = require("node-html-parser");
const Airport = require("./entities/airport");

/**
 * Parse the airlines listing HTML page into a list of airline objects.
 *
 * @param {string|Buffer} html
 * @return {Array<object>}
 */
function parseAirlinesHtml(html) {
    const root = parse(typeof html === "string" ? html : html.toString());
    const tbody = root.querySelector("tbody");

    if (!tbody) {
        console.warn("parseAirlinesHtml: no <tbody> in response — FR24 page layout may have changed.");
        return [];
    }

    const airlines = [];

    for (const tr of tbody.querySelectorAll("tr")) {
        const tdNotranslate = tr.querySelector("td.notranslate");

        if (!tdNotranslate) continue;

        const aElement = tdNotranslate.querySelector("a[href^='/data/airlines']");

        if (!aElement) continue;

        const airlineName = aElement.text.trim();

        if (airlineName.length < 2) continue;

        const tdElements = tr.querySelectorAll("td");
        let iata = null;
        let icao = null;

        if (tdElements.length >= 4) {
            const codesText = tdElements[3].text.trim();

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
            const aircraftsText = tdElements[4].text.trim();

            if (aircraftsText) {
                nAircrafts = parseInt(aircraftsText.split(" ")[0].trim(), 10);
            }
        }

        airlines.push({ "Name": airlineName, "ICAO": icao, "IATA": iata, "n_aircrafts": nAircrafts });
    }

    return airlines;
}

/**
 * Parse the airports listing HTML page for a country into a list of Airport instances.
 *
 * @param {string|Buffer} html
 * @param {string} countryHref - Full URL used to fetch the page (used to derive the display name)
 * @return {Array<Airport>}
 */
function parseAirportsHtml(html, countryHref) {
    const root = parse(typeof html === "string" ? html : html.toString());
    const tbody = root.querySelector("tbody");

    if (!tbody) {
        console.warn(`parseAirportsHtml: no <tbody> for ${countryHref} — FR24 page layout may have changed.`);
        return [];
    }

    const countryDisplayName = countryHref.split("/").pop().replace(/-/g, " ")
        .split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

    const airports = [];

    for (const tr of tbody.querySelectorAll("tr")) {
        const aElement = tr.querySelector("a[data-iata][data-lat][data-lon]");

        if (!aElement) continue;

        let icao = "";
        let iata = aElement.getAttribute("data-iata") || "";
        const latitude = aElement.getAttribute("data-lat") || "";
        const longitude = aElement.getAttribute("data-lon") || "";
        let namePart = aElement.text.trim();

        const smallElement = aElement.querySelector("small");

        if (smallElement) {
            const smallText = smallElement.text.trim();
            const codesText = smallText.replace(/^\(/, "").replace(/\)$/, "").trim();
            namePart = namePart.replace(smallText, "").replace(/\(\)/, "").trim();

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

        let latNum = latitude ? parseFloat(latitude) : null;
        let lonNum = longitude ? parseFloat(longitude) : null;
        if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
            console.warn(
                `parseAirportsHtml: invalid coordinates for airport "${namePart}" ` +
                `(lat=${latitude}, lon=${longitude}) — skipping position.`,
            );
            latNum = null;
            lonNum = null;
        }

        airports.push(new Airport({
            "name": namePart,
            "icao": icao,
            "iata": iata,
            "lat": latNum,
            "lon": lonNum,
            "alt": null,
            "country": countryDisplayName,
        }));
    }

    return airports;
}

module.exports = { parseAirlinesHtml, parseAirportsHtml };
