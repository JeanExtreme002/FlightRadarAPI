/**
 * Offline parser tests against bundled fixtures.
 *
 * These tests run with no network access and exist specifically so that PRs
 * can be gated on the parser logic without depending on FR24 being reachable
 * or its payloads being stable. When FR24 changes a page or feed, update the
 * fixtures (re-saving a real response is fine) — the assertions here guard the
 * parser's invariants, not byte-for-byte equality with production.
 */
const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

const { parseAirlinesHtml, parseAirportsJson, countryToSlug } = require("../FlightRadarAPI/parsers");

const FIXTURES = path.join(__dirname, "fixtures");
const load = (name) => fs.readFileSync(path.join(FIXTURES, name), "utf-8");


describe("parseAirlinesHtml (offline)", function() {
    let airlines;
    before(function() {
        airlines = parseAirlinesHtml(load("airlines.html"));
    });

    it("extracts known airline rows", function() {
        const names = airlines.map((a) => a.Name);
        expect(names).to.include("LATAM Airlines");
        expect(names).to.include("Gol");
        expect(names).to.include("Delta Air Lines");
    });

    it("splits IATA and ICAO when both are present", function() {
        const byName = Object.fromEntries(airlines.map((a) => [a.Name, a]));
        expect(byName["LATAM Airlines"].IATA).to.equal("LA");
        expect(byName["LATAM Airlines"].ICAO).to.equal("LAN");
        expect(byName["Gol"].IATA).to.equal("G3");
        expect(byName["Gol"].ICAO).to.equal("GLO");
    });

    it("handles IATA-only or ICAO-only rows", function() {
        const byName = Object.fromEntries(airlines.map((a) => [a.Name, a]));
        expect(byName["Sky2"].IATA).to.equal("SK");
        expect(byName["Sky2"].ICAO).to.equal(null);
        expect(byName["SkyTeam"].ICAO).to.equal("SKT");
        expect(byName["SkyTeam"].IATA).to.equal(null);
    });

    it("parses aircraft count from the last column", function() {
        const byName = Object.fromEntries(airlines.map((a) => [a.Name, a]));
        expect(byName["LATAM Airlines"].n_aircrafts).to.equal(340);
        expect(byName["Gol"].n_aircrafts).to.equal(140);
    });

    it("skips rows without notranslate td or with wrong href", function() {
        expect(airlines.length).to.equal(5);
    });

    it("returns an empty list for empty or unrecognised HTML", function() {
        expect(parseAirlinesHtml("")).to.deep.equal([]);
        expect(parseAirlinesHtml("<html><body><p>no tbody here</p></body></html>")).to.deep.equal([]);
    });
});


describe("parseAirportsJson (offline)", function() {
    let airports;
    before(function() {
        airports = parseAirportsJson(load("airports.json"));
    });

    it("extracts iata, icao, name, country and position", function() {
        const byIata = Object.fromEntries(airports.map((a) => [a.iata, a]));
        expect(byIata["GRU"]).to.exist;
        expect(byIata["GIG"]).to.exist;
        expect(byIata["GRU"].icao).to.equal("SBGR");
        expect(byIata["GRU"].country).to.equal("Brazil");
        expect(byIata["GRU"].latitude).to.be.closeTo(-23.429991, 1e-6);
        expect(byIata["GRU"].longitude).to.be.closeTo(-46.4674, 1e-6);
        expect(byIata["GRU"].altitude).to.equal(2436);
    });

    it("keeps every country when no filter is given", function() {
        const countries = new Set(airports.map((a) => a.country));
        expect(countries).to.include("Brazil");
        expect(countries).to.include("United States");
        expect(countries).to.include("Spain");
    });

    it("filters by the slugs from the Countries enum", function() {
        const filtered = parseAirportsJson(load("airports.json"), ["united-states"]);
        expect(filtered.length).to.be.above(0);
        for (const airport of filtered) {
            expect(airport.country).to.equal("United States");
        }
    });

    it("accepts several countries at once", function() {
        const filtered = parseAirportsJson(load("airports.json"), ["brazil", "spain"]);
        const countries = new Set(filtered.map((a) => a.country));
        expect([...countries].sort()).to.deep.equal(["Brazil", "Spain"]);
    });

    it("invalid coordinates become null (regression test for 0,0 fallback)", function() {
        const bad = airports.find((a) => a.iata === "BAD");
        expect(bad.latitude).to.equal(null);
        expect(bad.longitude).to.equal(null);
    });

    it("keeps FR24's own country spelling and still slugifies it for URLs", function() {
        const ann = airports.find((airport) => airport.iata === "VBA");

        expect(ann.country).to.equal("Myanmar (Burma)");
        expect(countryToSlug(ann.country)).to.equal("myanmar-burma");
        // Feed sends `alt` as a string on a few rows; it must read as a number.
        expect(ann.altitude).to.equal(43);
    });

    it("matches a filter written with either spelling of the country", function() {
        for (const slug of ["myanmar-burma", "Myanmar (Burma)"]) {
            expect(parseAirportsJson(load("airports.json"), [slug]).length).to.equal(1);
        }
    });

    it("rejects numeric-looking junk instead of truncating it", function() {
        const payload = JSON.stringify({ rows: [{
            name: "Junk Airport", iata: "JNK", icao: "JJNK",
            lat: "43.30 N", lon: -8.37725, country: "Spain", alt: "-1",
        }] });
        const [airport] = parseAirportsJson(payload);

        expect(airport.latitude).to.equal(null);
        expect(airport.longitude).to.be.closeTo(-8.37725, 1e-6);
        expect(airport.altitude).to.equal(-1);
    });

    it("never turns an unusable coordinate into 0", function() {
        // 0 would put the airport in the Gulf of Guinea. Kept in step with the
        // Python port, whose `float` rejects each of these too.
        for (const value of [" ", "   ", [], [43], "abc", "0x10", "1_000", "inf", "1e999", "-1e999", true, {}]) {
            const payload = JSON.stringify({ rows: [{
                name: "X", iata: "XXX", icao: "XXXX", country: "Spain",
                lat: value, lon: value, alt: value,
            }] });
            const [airport] = parseAirportsJson(payload);

            expect(airport.latitude, `lat for ${JSON.stringify(value)}`).to.equal(null);
            expect(airport.longitude, `lon for ${JSON.stringify(value)}`).to.equal(null);
            expect(airport.altitude, `alt for ${JSON.stringify(value)}`).to.equal(null);
        }
    });

    it("returns an empty list for an unknown country", function() {
        expect(parseAirportsJson(load("airports.json"), ["atlantis"])).to.deep.equal([]);
    });

    it("parses a body that arrived as raw bytes", function() {
        // request() returns an ArrayBuffer when the response carries an
        // unexpected content-type; the JSON inside is still good.
        const json = load("airports.json");

        for (const payload of [Buffer.from(json), new TextEncoder().encode(json), new TextEncoder().encode(json).buffer]) {
            expect(parseAirportsJson(payload).length, payload.constructor.name).to.equal(airports.length);
        }
    });

    it("returns an empty list when the feed has no rows", function() {
        expect(parseAirportsJson("")).to.deep.equal([]);
        expect(parseAirportsJson("{}")).to.deep.equal([]);
        expect(parseAirportsJson("<html>not json</html>")).to.deep.equal([]);
    });
});


describe("countryToSlug (offline)", function() {
    it("matches the spelling used by the Countries enum", function() {
        expect(countryToSlug("United States")).to.equal("united-states");
        expect(countryToSlug("Democratic Republic Of The Congo")).to.equal("democratic-republic-of-the-congo");
        expect(countryToSlug("Curacao")).to.equal("curacao");
        expect(countryToSlug("Curaçao")).to.equal("curacao");
        expect(countryToSlug("")).to.equal("");
    });

    it("strips the parentheses FR24 uses, keeping country flag URLs valid", function() {
        // Regression: `getCountryFlag(airport.country)` 404'd for these while the
        // slug was built with a plain space-to-hyphen replacement.
        expect(countryToSlug("Myanmar (Burma)")).to.equal("myanmar-burma");
        expect(countryToSlug("Cocos (Keeling) Islands")).to.equal("cocos-keeling-islands");
        expect(countryToSlug("Falkland Islands (Malvinas)")).to.equal("falkland-islands-malvinas");
        expect(countryToSlug("Timor-Leste (East Timor)")).to.equal("timor-leste-east-timor");
    });
});
