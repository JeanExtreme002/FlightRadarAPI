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

const {
    parseAirlinesHtml, parseInertiaPage, parseAirportsIndex, parseAirportsPage, countryToSlug,
} = require("../FlightRadarAPI/parsers");
const { Countries } = require("../FlightRadarAPI/core");

const FIXTURES = path.join(__dirname, "fixtures");
const load = (name) => fs.readFileSync(path.join(FIXTURES, name), "utf-8");
const loadJson = (name) => JSON.parse(load(name));


describe("parseAirlinesHtml (offline)", function() {
    let airlines;
    let byName;
    before(function() {
        airlines = parseAirlinesHtml(load("airlines.html"));
        byName = Object.fromEntries(airlines.map((a) => [a.Name, a]));
    });

    it("extracts known airline rows", function() {
        const names = airlines.map((a) => a.Name);
        expect(names).to.include("LATAM Airlines");
        expect(names).to.include("Gol");
        expect(names).to.include("Delta Air Lines");
    });

    it("splits IATA and ICAO when both are present", function() {
        expect(byName["LATAM Airlines"].IATA).to.equal("LA");
        expect(byName["LATAM Airlines"].ICAO).to.equal("LAN");
        expect(byName["Gol"].IATA).to.equal("G3");
        expect(byName["Gol"].ICAO).to.equal("GLO");
    });

    it("handles IATA-only or ICAO-only rows", function() {
        expect(byName["Sky2"].IATA).to.equal("SK");
        expect(byName["Sky2"].ICAO).to.equal(null);
        expect(byName["SkyTeam"].ICAO).to.equal("SKT");
        expect(byName["SkyTeam"].IATA).to.equal(null);
    });

    it("parses the aircraft count", function() {
        expect(byName["LATAM Airlines"].n_aircrafts).to.equal(340);
        expect(byName["Gol"].n_aircrafts).to.equal(140);
        // Thousands separator, as the page prints large fleets.
        expect(byName["Delta Air Lines"].n_aircrafts).to.equal(1900);
        // Only the "Largest fleets" section carries a count.
        expect(byName["Sky2"].n_aircrafts).to.equal(null);
    });

    it("merges an airline listed in two sections", function() {
        // Delta and Gol appear under "Largest fleets" and again under "All airlines".
        const names = airlines.map((a) => a.Name);
        expect(names.filter((name) => name === "Delta Air Lines")).to.have.lengthOf(1);
        expect(names.filter((name) => name === "Gol")).to.have.lengthOf(1);
    });

    it("keeps a code-shaped name", function() {
        expect(byName["TAP"]).to.deep.equal({ "Name": "TAP", "ICAO": "TAP", "IATA": "TP", "n_aircrafts": null });
    });

    it("skips invalid rows", function() {
        // 6 airlines; the section link, the entry with no link, the wrong href
        // and the one-letter name must be skipped.
        expect(airlines).to.have.lengthOf(6);
        expect(airlines.map((a) => a.Name)).to.not.include("All");
    });

    it("returns an empty list for empty or unrecognised HTML", function() {
        expect(parseAirlinesHtml("")).to.deep.equal([]);
        expect(parseAirlinesHtml("<html><body><p>no airlines here</p></body></html>")).to.deep.equal([]);
    });
});


describe("parseInertiaPage (offline)", function() {
    it("reads the data-page attribute", function() {
        const page = parseInertiaPage(load("airports_index.html"));
        expect(page.component).to.equal("Data/Airports");
        expect(page.version).to.equal("919b94d2a33f365a34f99828f6eeec6a");
        expect(page.props).to.have.property("airportsByCountry");
    });

    it("accepts a decoded JSON body", function() {
        const body = loadJson("airports_country.json");
        expect(parseInertiaPage(body)).to.equal(body);
    });

    it("reads a body that arrived as raw bytes", function() {
        // request() returns an ArrayBuffer on an unexpected content-type.
        const html = load("airports_index.html");

        for (const payload of [Buffer.from(html), new TextEncoder().encode(html), new TextEncoder().encode(html).buffer]) {
            expect(parseInertiaPage(payload).version, payload.constructor.name).to.equal("919b94d2a33f365a34f99828f6eeec6a");
        }
    });

    it("rejects unrecognised payloads", function() {
        expect(parseInertiaPage("")).to.equal(null);
        expect(parseInertiaPage("<html><body><div id=\"app\"></div></body></html>")).to.equal(null);
        expect(parseInertiaPage("<div data-page=\"not json\"></div>")).to.equal(null);
        expect(parseInertiaPage({ component: "Data/Airports" })).to.equal(null);
    });
});


describe("parseAirportsIndex (offline)", function() {
    it("lists every country with its slug", function() {
        const countries = parseAirportsIndex(load("airports_index.html"));
        expect(countries.map((c) => c.slug)).to.deep.equal(["brazil", "myanmar-burma", "uruguay"]);
        expect(countries[1].name).to.equal("MYANMAR (BURMA)");
    });

    it("produces slugs that match the Countries enum", function() {
        const known = new Set(Object.values(Countries));

        for (const country of parseAirportsIndex(load("airports_index.html"))) {
            expect(known.has(country.slug), country.slug).to.equal(true);
        }
    });

    it("returns an empty list for an invalid payload", function() {
        expect(parseAirportsIndex("")).to.deep.equal([]);
        expect(parseAirportsIndex({ props: {} })).to.deep.equal([]);
        expect(parseAirportsIndex({ props: { airportsByCountry: [1, "x", { name: null }] } })).to.deep.equal([]);
    });
});


describe("parseAirportsPage (offline)", function() {
    it("extracts the airports of a country", function() {
        const { airports, statePaths } = parseAirportsPage(loadJson("airports_country.json"));
        expect(statePaths).to.deep.equal([]);
        expect(airports.map((a) => a.iata)).to.deep.equal(["CYR", "MVD"]);

        const mvd = airports[1];
        expect(mvd.name).to.equal("Montevideo Carrasco International Airport");
        expect(mvd.icao).to.equal("SUMU");
        expect(mvd.country).to.equal("Uruguay");
    });

    it("carries no position: the listing has none", function() {
        const { airports } = parseAirportsPage(loadJson("airports_country.json"));

        for (const airport of airports) {
            expect(airport.latitude).to.equal(null);
            expect(airport.longitude).to.equal(null);
            expect(airport.altitude).to.equal(null);
        }
    });

    it("returns the state pages of a split country", function() {
        const { airports, statePaths } = parseAirportsPage(loadJson("airports_country_states.json"));
        expect(airports).to.deep.equal([]);
        expect(statePaths).to.deep.equal(["/data/airports/brazil/rj", "/data/airports/brazil/sp"]);
    });

    it("keeps the country name on a state page", function() {
        const { airports, statePaths } = parseAirportsPage(loadJson("airports_state_sp.json"));
        expect(statePaths).to.deep.equal([]);
        expect(airports.map((a) => a.iata)).to.deep.equal(["GRU", "CGH"]);
        expect(new Set(airports.map((a) => a.country))).to.deep.equal(new Set(["Brazil"]));
    });

    it("reads an HTML page", function() {
        const { airports } = parseAirportsPage(load("airports_country.html"));
        expect(airports.map((a) => a.iata)).to.deep.equal(["RGN"]);
        // FR24 spells it "Myanmar (Burma)" on the page and "myanmar-burma" in URLs.
        expect(airports[0].country).to.equal("Myanmar (Burma)");
        expect(countryToSlug(airports[0].country)).to.equal(Countries.MYANMAR_BURMA);
    });

    it("skips rows that are not objects, as the Python port does", function() {
        const payload = { props: { country: { name: "Nowhere" }, airports: [1, "x", null, [1, 2], { iata: "RRR" }] } };
        const { airports } = parseAirportsPage(payload);
        expect(airports.map((a) => a.iata)).to.deep.equal(["RRR"]);
    });

    it("keeps text fields as strings whatever the page sends", function() {
        // Anything else breaks getCountryFlag(airport.country).
        const payload = { props: { country: { name: ["Brazil"] }, airports: [{ name: 42, iata: null, icao: { x: 1 } }] } };
        const [airport] = parseAirportsPage(payload).airports;
        expect([airport.name, airport.iata, airport.icao, airport.country]).to.deep.equal(["", "", "", ""]);
    });

    it("ignores malformed states", function() {
        const payload = { props: { states: [{ url: "/data/airports/x/a" }, { url: "" }, { code: "B" }, "junk", { url: 3 }] } };
        expect(parseAirportsPage(payload)).to.deep.equal({ airports: [], statePaths: ["/data/airports/x/a"] });
    });

    it("returns nothing for an invalid payload", function() {
        const empty = { airports: [], statePaths: [] };
        expect(parseAirportsPage("")).to.deep.equal(empty);
        expect(parseAirportsPage("<html>not a data page</html>")).to.deep.equal(empty);
        expect(parseAirportsPage({ props: {} })).to.deep.equal(empty);
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

    it("takes a Countries value, which is what getAirports accepts", function() {
        expect(countryToSlug(Countries.BRAZIL)).to.equal("brazil");
        expect(countryToSlug(Countries.MYANMAR_BURMA)).to.equal("myanmar-burma");
    });

    it("strips the parentheses FR24 uses, keeping country flag URLs valid", function() {
        // These 404'd while the slug was a plain space-to-hyphen replacement.
        expect(countryToSlug("Myanmar (Burma)")).to.equal("myanmar-burma");
        expect(countryToSlug("Cocos (Keeling) Islands")).to.equal("cocos-keeling-islands");
        expect(countryToSlug("Falkland Islands (Malvinas)")).to.equal("falkland-islands-malvinas");
        expect(countryToSlug("Timor-Leste (East Timor)")).to.equal("timor-leste-east-timor");
    });
});
