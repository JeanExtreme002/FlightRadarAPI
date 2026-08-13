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

// ASCII decimal numbers only, so both ports accept and reject exactly the same
// strings. `Number` on its own would take "0x10" and "" (as 0) where Python's
// `float` refuses them, and `parseFloat` would read "43.30 N" as 43.3.
const NUMERIC_PATTERN = /^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$/;

// Trimmed explicitly: String.trim() also strips U+FEFF, which Python's
// str.strip() keeps, while str.strip() drops U+001C-U+001F, which trim() keeps.
const SURROUNDING_SPACE = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g;

/**
 * Coerce a numeric feed field into a number, or null when it is unusable.
 *
 * An unusable coordinate must not become 0: that would place the airport in the
 * Gulf of Guinea instead of marking its position as unknown.
 *
 * @param {*} value
 * @return {number|null}
 */
function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    // Only strings are worth parsing. Stringifying anything else would let
    // `[43]` through as 43, which Python's `float` rejects.
    if (typeof value !== "string") return null;

    const text = value.replace(SURROUNDING_SPACE, "");

    return NUMERIC_PATTERN.test(text) ? toNumber(Number(text)) : null;
}

/**
 * Keep a text field as a string, or "" when the feed sends anything else.
 *
 * Airport declares these as strings, and callers treat them as such —
 * `getCountryFlag(airport.country)` would happily slugify an object into
 * "object-object" and request that flag.
 *
 * @param {*} value
 * @return {string}
 */
function toStringField(value) {
    return typeof value === "string" ? value : "";
}

/**
 * Decode a response body into text, or null when it arrived already parsed.
 *
 * `request()` returns an ArrayBuffer whenever the response carries an
 * unexpected content-type, so a perfectly good JSON body can land here as raw
 * bytes rather than as an object.
 *
 * @param {*} payload
 * @return {string|null}
 */
function toText(payload) {
    if (typeof payload === "string") return payload;
    if (Buffer.isBuffer(payload)) return payload.toString();
    if (payload instanceof ArrayBuffer) return Buffer.from(payload).toString();
    if (ArrayBuffer.isView(payload)) return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).toString();
    return null;
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
    const text = toText(payload);

    if (text !== null) {
        try {
            data = JSON.parse(text);
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
    const unpositioned = [];
    const airports = [];

    for (const row of rows) {
        if (!row || typeof row !== "object") continue;

        const slug = countryToSlug(row["country"]);

        if (wanted) {
            if (!wanted.has(slug)) continue;
            matched.add(slug);
        }

        let latitude = toNumber(row["lat"]);
        let longitude = toNumber(row["lon"]);

        // Half a position is not a position: a consumer gating on `latitude`
        // would treat the airport as located and read a null longitude.
        if (latitude === null || longitude === null) {
            latitude = null;
            longitude = null;
            unpositioned.push(toStringField(row["name"]));
        }

        airports.push(new Airport({
            "name": toStringField(row["name"]),
            "icao": toStringField(row["icao"]),
            "iata": toStringField(row["iata"]),
            "lat": latitude,
            "lon": longitude,
            "alt": toNumber(row["alt"]),
            "country": toStringField(row["country"]),
        }));
    }

    // Summarised rather than logged per row: the feed carries every airport, so
    // a degraded response would otherwise print hundreds of lines per call.
    if (unpositioned.length > 0) {
        const sample = unpositioned.slice(0, 3).map((name) => `"${name}"`).join(", ");
        console.warn(
            `parseAirportsJson: ${unpositioned.length} airport(s) had unusable coordinates ` +
            `and carry no position (e.g. ${sample}).`,
        );
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
