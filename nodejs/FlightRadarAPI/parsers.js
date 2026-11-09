const { parse } = require("node-html-parser");
const Airport = require("./entities/airport");

// An airline code badge: a two-letter IATA code or a three-letter ICAO code.
// ASCII only, so a stray Unicode letter does not pass for a code.
const AIRLINE_CODE_PATTERN = /^[A-Z0-9]{2,3}$/;

// A fleet size as the page prints it: "340" or "3,878".
const AIRCRAFT_COUNT_PATTERN = /^\d{1,3}(?:[,.]\d{3})*$|^\d+$/;

const AIRLINES_PATH_PREFIX = "/data/airlines/";

/**
 * Whether an element holds no other element (text and comments only).
 *
 * @param {HTMLElement} element
 * @return {boolean}
 */
function isLeaf(element) {
    return element.childNodes.every((node) => node.nodeType !== 1);
}

/**
 * Text of the `tag` elements under `root` that hold no other element.
 *
 * The name element is left out by its `title` attribute: an airline called
 * "TAP" would otherwise read as an ICAO code.
 *
 * @param {HTMLElement} root
 * @param {string} tag
 * @return {Array<string>}
 */
function leafTexts(root, tag) {
    return root.querySelectorAll(tag)
        .filter((element) => isLeaf(element) && !element.hasAttribute("title"))
        .map((element) => element.text.trim());
}

/**
 * The airline name of a listing entry.
 *
 * The name sits in the element titled with it, with the logo's aria-label as a
 * fallback; the anchor text also carries the codes and the fleet size.
 *
 * @param {HTMLElement} link
 * @return {string}
 */
function airlineName(link) {
    for (const attribute of ["title", "aria-label"]) {
        const element = link.querySelector(`[${attribute}]`);

        if (element) return String(element.getAttribute(attribute) ?? "").trim();
    }

    return link.text.trim();
}

/**
 * Parse the airlines listing page into a list of airline objects.
 *
 * Every airline is a link to its data page, with the IATA and ICAO codes as
 * badges next to the name. The "Largest fleets" section repeats a few airlines
 * with their aircraft count; an airline the page lists twice becomes one entry
 * carrying everything the page said about it.
 *
 * @param {string|Buffer} html
 * @return {Array<object>}
 */
function parseAirlinesHtml(html) {
    const root = parse(toText(html) ?? "");
    const links = root.querySelectorAll("a[href]")
        .filter((link) => String(link.getAttribute("href")).startsWith(AIRLINES_PATH_PREFIX));

    if (links.length === 0) {
        console.warn("parseAirlinesHtml: no airline links in response — FR24 page layout may have changed.");
        return [];
    }

    // Keyed by href, so an airline listed in two sections becomes one entry.
    const airlines = new Map();

    for (const link of links) {
        const name = airlineName(link);

        if (name.length < 2) continue;

        const codes = leafTexts(link, "span").filter((text) => AIRLINE_CODE_PATTERN.test(text));
        const iata = codes.find((code) => code.length === 2) ?? null;
        const icao = codes.find((code) => code.length === 3) ?? null;

        // Section links ("All") point under /data/airlines/ too; a code tells
        // an airline apart from them.
        if (iata === null && icao === null) continue;

        const countText = leafTexts(link, "strong").find((text) => AIRCRAFT_COUNT_PATTERN.test(text));
        const nAircrafts = countText === undefined ? null : parseInt(countText.replace(/\D/g, ""), 10);

        const href = link.getAttribute("href");

        if (!airlines.has(href)) {
            airlines.set(href, { "Name": name, "ICAO": null, "IATA": null, "n_aircrafts": null });
        }

        const airline = airlines.get(href);

        for (const [key, value] of [["ICAO", icao], ["IATA", iata], ["n_aircrafts", nAircrafts]]) {
            if (airline[key] === null) airline[key] = value;
        }
    }

    return [...airlines.values()];
}

/**
 * Slugify a country name the way FR24 spells it in its data page URLs, so feed
 * rows can be matched against the Countries enum.
 *
 * @param {string} country - Country name as spelled by FR24 (e.g. "United States")
 * @return {string} URL-friendly form matching the Countries enum (e.g. "united-states")
 */
function countryToSlug(country) {
    // Diacritics stripped so a future "Curaçao" still matches "curacao".
    // Punctuation becomes a hyphen rather than being deleted: FR24's own assets
    // are named that way, e.g. flags-small/cote-d-ivoire.svg.
    return String(country ?? "")
        .normalize("NFKD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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
 * Whether a value is a plain object: arrays are objects in JS, and Python's
 * isinstance(value, dict) drops them.
 *
 * @param {*} value
 * @return {boolean}
 */
function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Return the Inertia page object (component, props, version) of a FR24 data page.
 *
 * Served as HTML, the page keeps it JSON-encoded in the data-page attribute of
 * its root element; asked with Core.inertiaHeaders, FR24 sends it as the body,
 * which `request()` has already decoded into an object.
 *
 * @param {object|string|Buffer|ArrayBuffer} payload
 * @return {object|null}
 */
function parseInertiaPage(payload) {
    let page = payload;
    const text = toText(payload);

    if (text !== null) {
        // node-html-parser decodes the attribute's entities (&quot;, &#x27;...).
        const root = parse(text).querySelector("[data-page]");

        if (!root) {
            console.warn("parseInertiaPage: no data-page attribute in response — FR24 page layout may have changed.");
            return null;
        }

        try {
            page = JSON.parse(root.getAttribute("data-page"));
        }
        catch {
            console.warn("parseInertiaPage: data-page is not valid JSON — FR24 page layout may have changed.");
            return null;
        }
    }

    if (!isObject(page) || !isObject(page["props"])) {
        console.warn("parseInertiaPage: no page props in response — FR24 page layout may have changed.");
        return null;
    }

    return page;
}

/**
 * Parse the airports index (Core.airportsDataUrl) into its countries.
 *
 * Each entry has the country "name" as FR24 prints it ("UNITED STATES") and the
 * "slug" of its listing page, which is also its Countries enum value.
 *
 * @param {object|string|Buffer|ArrayBuffer} payload
 * @return {Array<{name: string, slug: string}>}
 */
function parseAirportsIndex(payload) {
    const page = parseInertiaPage(payload);
    const rows = page !== null ? page["props"]["airportsByCountry"] : null;

    if (!Array.isArray(rows)) {
        console.warn("parseAirportsIndex: no \"airportsByCountry\" list in response — FR24 page layout may have changed.");
        return [];
    }

    const countries = [];

    for (const row of rows) {
        if (!isObject(row)) continue;

        const name = toStringField(row["name"]);
        const slug = countryToSlug(name);

        if (slug) countries.push({ name, slug });
    }

    return countries;
}

/**
 * Parse a country or state airports page into its airports and state pages.
 *
 * A country with many airports lists its states instead, each with the path of
 * its own page; those paths come back for the caller to fetch. The listing has
 * no coordinates or altitude: `getAirport(code)` has them for one airport.
 *
 * @param {object|string|Buffer|ArrayBuffer} payload
 * @return {{airports: Array<Airport>, statePaths: Array<string>}}
 */
function parseAirportsPage(payload) {
    const page = parseInertiaPage(payload);

    if (page === null) {
        return { airports: [], statePaths: [] };
    }

    const props = page["props"];
    const country = props["country"];
    const countryName = isObject(country) ? toStringField(country["name"]) : "";

    const rows = Array.isArray(props["airports"]) ? props["airports"] : [];
    const states = Array.isArray(props["states"]) ? props["states"] : [];

    const airports = rows.filter(isObject).map((row) => new Airport({
        "name": toStringField(row["name"]),
        "icao": toStringField(row["icao"]),
        "iata": toStringField(row["iata"]),
        "lat": null,
        "lon": null,
        "alt": null,
        "country": countryName,
    }));

    const statePaths = states
        .filter((state) => isObject(state) && typeof state["url"] === "string" && state["url"] !== "")
        .map((state) => state["url"]);

    return { airports, statePaths };
}

module.exports = { parseAirlinesHtml, parseInertiaPage, parseAirportsIndex, parseAirportsPage, countryToSlug };
