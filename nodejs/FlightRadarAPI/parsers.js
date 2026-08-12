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
 * Slugify a country name the way FR24 spells it in its data page URLs, so feed
 * rows can be matched against the Countries enum.
 *
 * @param {string} country - Country name as spelled by FR24 (e.g. "United States")
 * @return {string} URL-friendly form matching the Countries enum (e.g. "united-states")
 */
function countryToSlug(country) {
    // The feed is ASCII today ("Curacao"); stripping diacritics keeps the match
    // working if that ever changes.
    return String(country ?? "")
        .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Coerce a feed coordinate into a number, or null when it is unusable.
 *
 * Invalid coordinates must not become 0.0: that would place the airport in the
 * Gulf of Guinea instead of marking its position as unknown.
 *
 * @param {*} value
 * @return {number|null}
 */
function toCoordinate(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(number) ? number : null;
}

/**
 * Parse the airports JSON feed into a list of Airport instances.
 *
 * @param {object|string|Buffer} payload - Body of Core.airportsJsonUrl
 * @param {Array<string>} [countries] - Country slugs from the Countries enum; every airport is kept when omitted
 * @return {Array<Airport>}
 */
function parseAirportsJson(payload, countries = null) {
    let data = payload;

    if (typeof data === "string" || Buffer.isBuffer(data)) {
        try {
            data = JSON.parse(data.toString());
        }
        catch {
            console.warn("parseAirportsJson: response is not valid JSON — FR24 feed may have changed.");
            return [];
        }
    }

    const rows = data && Array.isArray(data["rows"]) ? data["rows"] : null;

    if (!rows) {
        console.warn("parseAirportsJson: no \"rows\" array in response — FR24 feed may have changed.");
        return [];
    }

    const wanted = countries ? new Set(countries.map(countryToSlug)) : null;
    const matched = new Set();
    const airports = [];

    for (const row of rows) {
        if (!row || typeof row !== "object") continue;

        const slug = countryToSlug(row["country"]);

        if (wanted) {
            if (!wanted.has(slug)) continue;
            matched.add(slug);
        }

        const latitude = toCoordinate(row["lat"]);
        const longitude = toCoordinate(row["lon"]);

        if (latitude === null || longitude === null) {
            console.warn(
                `parseAirportsJson: invalid coordinates for airport "${row["name"] ?? ""}" ` +
                `(lat=${row["lat"]}, lon=${row["lon"]}) — skipping position.`,
            );
        }

        airports.push(new Airport({
            "name": row["name"] ?? "",
            "icao": row["icao"] ?? "",
            "iata": row["iata"] ?? "",
            "lat": latitude,
            "lon": longitude,
            "alt": toCoordinate(row["alt"]),
            "country": row["country"] ?? "",
        }));
    }

    if (wanted) {
        const missing = [...wanted].filter((slug) => !matched.has(slug));

        if (missing.length > 0) {
            console.warn(`parseAirportsJson: no airports found for ${missing.join(", ")} — check the Countries enum.`);
        }
    }

    return airports;
}

module.exports = { parseAirlinesHtml, parseAirportsJson, countryToSlug };
