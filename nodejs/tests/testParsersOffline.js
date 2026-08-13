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

// Every case here caught a real bug or pins a stated invariant. Keep it in step
// with the same list in python/tests/test_parsers_offline.py: the two ports have
// drifted apart on exactly these inputs before.
const NUMERIC_CASES = [
    ["whitespace", " ", null],
    ["an array holding a number", [43], null],
    ["a coordinate with a hemisphere suffix", "43.30 N", null],
    ["an exponent overflowing a double", "1e999", null],
    ["400 plain digits", "1".repeat(400), null],
    ["a whole number as a string", "2436", 2436],
    ["a negative decimal", "-23.4", -23.4],
    ["a genuine zero", 0, 0],
];


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

        // One unusable coordinate drops the whole position: half a position
        // would read as located to anything gating on `latitude`.
        expect(airport.latitude).to.equal(null);
        expect(airport.longitude).to.equal(null);
        // Altitude is independent of the position and survives.
        expect(airport.altitude).to.equal(-1);
    });

    it("agrees with the Python port on Unicode digits and stray control bytes", function() {
        // Python's \d matches "٤٣" and str.strip() drops U+001C, while
        // String.trim() drops U+FEFF -- each port used to accept what the other
        // rejected. Only ASCII digits and an explicit space set are allowed now.
        const read = (value) => {
            const payload = JSON.stringify({ rows: [{
                name: "X", iata: "XXX", icao: "XXXX", country: "Spain", lat: value, lon: value, alt: value,
            }] });
            return parseAirportsJson(payload)[0].altitude;
        };

        expect(read("\u0664\u0663"), "Arabic-Indic digits").to.equal(null);
        expect(read("\ufeff43"), "leading U+FEFF").to.equal(null);
        expect(read("\u001c43"), "leading U+001C").to.equal(null);
        expect(read("  43  "), "plain spaces still trimmed").to.equal(43);
    });

    it("returns an empty list for an unknown country", function() {
        expect(parseAirportsJson(load("airports.json"), ["atlantis"])).to.deep.equal([]);
    });

    it("survives numbers written raw in the JSON that no double can hold", function() {
        // Built as text on purpose: a JS number literal is already rounded (or
        // Infinity) before it can reach the payload, so only raw JSON exercises
        // this. Python reaches it as an unbounded int, where float() overflows.
        for (const literal of ["1".repeat(400), "9007199254740993", "-1".concat("1".repeat(399))]) {
            const payload = `{"rows":[{"name":"X","iata":"XXX","icao":"XXXX","country":"Spain","lat":${literal},"lon":1,"alt":2}]}`;
            const [airport] = parseAirportsJson(payload);

            expect(airport.latitude, literal.slice(0, 12)).to.satisfy(
                (latitude) => latitude === null || Number.isFinite(latitude),
            );
        }
    });

    it("keeps text fields as strings whatever the feed sends", function() {
        // Anything else breaks callers that treat these as strings, e.g.
        // getCountryFlag(airport.country) slugifying an object.
        for (const literal of ["null", "0", "false", "true", "[]", "{}", "123"]) {
            const payload = `{"rows":[{"name":${literal},"iata":${literal},"icao":${literal},` +
                `"country":${literal},"lat":1,"lon":2,"alt":3}]}`;
            const [airport] = parseAirportsJson(payload);

            expect([airport.name, airport.iata, airport.icao, airport.country], literal)
                .to.deep.equal(["", "", "", ""]);
        }
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


describe("parseAirportsJson numeric coercion", function() {
    for (const [label, input, expected] of NUMERIC_CASES) {
        it(`reads ${label} as ${JSON.stringify(expected)}`, function() {
            const payload = JSON.stringify({ rows: [{
                name: "X", iata: "XXX", icao: "XXXX", country: "Spain",
                lat: input, lon: input, alt: input,
            }] });
            const [airport] = parseAirportsJson(payload);

            expect(airport.latitude, "latitude").to.equal(expected);
            expect(airport.longitude, "longitude").to.equal(expected);
            expect(airport.altitude, "altitude").to.equal(expected);
        });
    }
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
