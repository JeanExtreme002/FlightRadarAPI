/**
 * Offline parser tests against bundled HTML fixtures.
 *
 * These tests run with no network access and exist specifically so that PRs
 * can be gated on the parser logic without depending on FR24 being reachable
 * or its HTML layout being stable. When FR24 changes the page structure,
 * update the fixtures (re-saving a real page is fine) — the assertions here
 * guard the parser's invariants, not byte-for-byte equality with production.
 */
const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

const { parseAirlinesHtml, parseAirportsHtml } = require("../FlightRadarAPI/parsers");

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


describe("parseAirportsHtml (offline)", function() {
    let airports;
    before(function() {
        airports = parseAirportsHtml(load("airports_brazil.html"), "/data/airports/brazil");
    });

    it("extracts iata, icao, name, country and position", function() {
        const byIata = Object.fromEntries(airports.map((a) => [a.iata, a]));
        expect(byIata["GRU"]).to.exist;
        expect(byIata["GIG"]).to.exist;
        expect(byIata["GRU"].icao).to.equal("SBGR");
        expect(byIata["GRU"].country).to.equal("Brazil");
        expect(byIata["GRU"].latitude).to.be.closeTo(-23.4356, 1e-6);
        expect(byIata["GRU"].longitude).to.be.closeTo(-46.4731, 1e-6);
    });

    it("handles airports whose small tag has only one code", function() {
        const cgh = airports.find((a) => a.iata === "CGH");
        expect(cgh.icao).to.equal("");
    });

    it("invalid coordinates become null (regression test for 0,0 fallback)", function() {
        const bad = airports.find((a) => a.iata === "BAD");
        expect(bad.latitude).to.equal(null);
        expect(bad.longitude).to.equal(null);
    });

    it("derives the display country from the URL slug", function() {
        const usAirports = parseAirportsHtml(load("airports_brazil.html"), "/data/airports/united-states");
        for (const a of usAirports) {
            expect(a.country).to.equal("United States");
        }
    });

    it("returns an empty list for empty input", function() {
        expect(parseAirportsHtml("", "/data/airports/brazil")).to.deep.equal([]);
    });
});
