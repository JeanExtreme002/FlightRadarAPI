/**
 * Offline tests for the page crawl behind getAirports().
 *
 * FR24 lists airports one Inertia page per country, and per state for the
 * largest countries. These tests pin down which pages the crawl asks for and
 * how it reads them, against the bundled fixtures, so the PR gate covers the
 * orchestration without reaching FR24.
 */
const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

const { FlightRadar24API, Countries } = require("../FlightRadarAPI/index");
const Core = require("../FlightRadarAPI/core");
const { parseInertiaPage } = require("../FlightRadarAPI/parsers");

const FIXTURES = path.join(__dirname, "fixtures");
const load = (name) => fs.readFileSync(path.join(FIXTURES, name), "utf-8");

const INDEX_VERSION = "919b94d2a33f365a34f99828f6eeec6a";

// Every page the fixtures model, by the path FR24 serves it at.
const PAGES = {
    "/data/airports": "airports_index.html",
    "/data/airports/uruguay": "airports_country.json",
    "/data/airports/brazil": "airports_country_states.json",
    "/data/airports/brazil/sp": "airports_state_sp.json",
    "/data/airports/brazil/rj": "airports_state_rj.json",
    "/data/airports/myanmar-burma": "airports_country.html",
};

/**
 * The Inertia page object of a fixture, as the request layer would decode a JSON body.
 *
 * @param {string} fixture
 * @return {object}
 */
function pageOf(fixture) {
    if (fixture.endsWith(".json")) return JSON.parse(load(fixture));

    const page = parseInertiaPage(load(fixture));
    expect(page).to.not.equal(null);
    return page;
}

/**
 * Swap in a client double that serves the fixture pages the way FR24 does.
 *
 * A request carrying the inertia headers gets the page JSON when the version
 * matches and a 409 otherwise; a plain request gets the HTML. The index page
 * only exists as HTML, like the real one as the crawl fetches it.
 *
 * @param {string|null} [version] - Asset version the fake deployment runs
 * @return {{api: FlightRadar24API, calls: Array<object>, paths: Function}}
 */
function apiWithFixturePages(version = INDEX_VERSION) {
    const api = new FlightRadar24API();
    const calls = [];

    const serve = async (url, options = {}) => {
        calls.push({ url, options });
        const pagePath = url.replace(Core.flightRadarBaseUrl, "");
        let fixture = PAGES[pagePath] ?? "airports_index.html";
        const headers = options.headers ?? {};

        if (headers["x-inertia"] === "true") {
            if (headers["x-inertia-version"] !== version) {
                expect(options.allowedErrorCodes ?? [], "a 409 must not raise").to.include(409);
                return { content: "", statusCode: 409, cookies: {} };
            }
            return { content: pageOf(fixture), statusCode: 200, cookies: {} };
        }

        if (fixture.endsWith(".json")) {
            fixture = fixture.replace(".json", ".html");

            if (!fs.existsSync(path.join(FIXTURES, fixture))) fixture = "airports_country.html";
        }
        return { content: load(fixture), statusCode: 200, cookies: {} };
    };

    api.__client = { request: serve, requestStandalone: serve };

    const paths = () => calls.map((call) => call.url.replace(Core.flightRadarBaseUrl, ""));

    return { api, calls, paths };
}

/**
 * Run fn while capturing console.warn, returning what it printed.
 *
 * @param {Function} fn
 * @return {Promise<Array<string>>}
 */
async function capturingWarnings(fn) {
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));

    try {
        await fn();
    }
    finally {
        console.warn = original;
    }
    return warnings;
}


describe("getAirports() page crawl (offline)", function() {
    it("crawls the country, then its states", async function() {
        const { api, paths } = apiWithFixturePages();

        const airports = await api.getAirports([Countries.BRAZIL]);

        expect(airports.map((a) => a.iata)).to.deep.equal(["GIG", "GRU", "CGH"]);
        expect(new Set(airports.map((a) => a.country))).to.deep.equal(new Set(["Brazil"]));
        expect(paths()).to.deep.equal([
            "/data/airports", "/data/airports/brazil", "/data/airports/brazil/rj", "/data/airports/brazil/sp",
        ]);
    });

    it("asks for the page JSON with the index version", async function() {
        const { api, calls } = apiWithFixturePages();

        await api.getAirports(Countries.URUGUAY);

        const [index, country] = calls;
        expect(index.options.headers).to.not.have.property("x-inertia");
        expect(country.options.headers["x-inertia"]).to.equal("true");
        expect(country.options.headers["x-inertia-version"]).to.equal(INDEX_VERSION);
    });

    it("falls back to the HTML when the assets were redeployed", async function() {
        const { api, calls, paths } = apiWithFixturePages("something-newer");

        const airports = await api.getAirports(["uruguay"]);

        // The index answered with a stale version, the JSON request got a 409
        // and the HTML page was read instead.
        expect(airports).to.have.lengthOf(1);
        expect(paths()).to.deep.equal(["/data/airports", "/data/airports/uruguay", "/data/airports/uruguay"]);
        expect(calls[2].options.headers).to.deep.equal(Core.htmlHeaders);
    });

    it("walks the whole index when no country is given", async function() {
        const { api, paths } = apiWithFixturePages();

        const airports = await api.getAirports();

        expect(airports.map((a) => a.iata)).to.deep.equal(["GIG", "GRU", "CGH", "RGN", "CYR", "MVD"]);
        expect(paths()).to.deep.equal([
            "/data/airports",
            "/data/airports/brazil", "/data/airports/myanmar-burma", "/data/airports/uruguay",
            "/data/airports/brazil/rj", "/data/airports/brazil/sp",
        ]);
    });

    it("accepts mixed spellings and drops repeats", async function() {
        const { api, paths } = apiWithFixturePages();

        const airports = await api.getAirports(["Uruguay", Countries.URUGUAY, "uruguay"]);

        expect(airports.map((a) => a.iata)).to.deep.equal(["CYR", "MVD"]);
        expect(paths()).to.deep.equal(["/data/airports", "/data/airports/uruguay"]);
    });

    it("makes no request for an empty filter", async function() {
        const { api, calls } = apiWithFixturePages();

        expect(await api.getAirports([])).to.deep.equal([]);
        expect(await api.getAirports(new Set())).to.deep.equal([]);
        expect(calls).to.deep.equal([]);
    });

    it("rejects a non-iterable filter", async function() {
        const { api, calls } = apiWithFixturePages();

        let error = null;
        try {
            await api.getAirports(42);
        }
        catch (caught) {
            error = caught;
        }

        expect(error).to.be.an.instanceOf(TypeError);
        expect(calls).to.deep.equal([]);
    });

    it("returns nothing and warns for an unknown country", async function() {
        const { api } = apiWithFixturePages();
        let airports;

        const warnings = await capturingWarnings(async () => {
            airports = await api.getAirports(["atlantis"]);
        });

        expect(airports).to.deep.equal([]);
        expect(warnings.join("\n")).to.include("no airports found for atlantis");
    });
});
