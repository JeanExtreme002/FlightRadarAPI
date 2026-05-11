const {FlightRadar24API, Flight, Countries, version} = require("..");
const expect = require("chai").expect;


describe("Testing FlightRadarAPI version " + version, function() {
    const frApi = new FlightRadar24API();

    describe("Getting Airlines", function() {
        const expected = 100;
        const airlines = ["LAN", "GLO", "DAL", "AZU", "UAE"];

        it("Expected at least " + expected + " airlines.", async function() {
            const results = await frApi.getAirlines();
            expect(results.length).to.be.above(expected - 1);
            
            const foundIcaos = new Set(results.filter(a => airlines.includes(a.ICAO)).map(a => a.ICAO));
            expect(foundIcaos.size).to.equal(airlines.length);
        });
    });

    describe("Getting Airport By IATA", function() {
        const expected = ["ATL", "LAX", "DXB", "DFW"];

        it("Expected finding the following airports: " + expected.join(", ") + ".", async function() {
            for (const iata of expected) {
                const airport = await frApi.getAirport(iata);
                expect(airport.iata).to.be.equal(iata);
            }
        });
    });

    describe("Getting Airport Details", function() {
        const expected = ["ATL", "LAX", "DXB", "DFW"];
        const targetKeys = ["airport", "airlines", "aircraftImages"];

        it("Expected getting details of the following airports: " + expected.join(", ") + ".", async function() {
            for (const iata of expected) {
                const details = await frApi.getAirportDetails(iata, 1);
                expect(details).to.include.all.keys(targetKeys);
                expect(details["airport"]["pluginData"]).to.include.all.keys("details");
            }
        });
    });

    describe("Getting Airports", function() {
        const expected = 1800;
        const countries = [Countries.BRAZIL, Countries.UNITED_STATES];

        it("Expected at least " + expected + " airports.", async function() {
            const results = await frApi.getAirports(countries);
            expect(results.length).to.be.above(expected - 1);
        });
    });

    describe("Getting Zones", function() {
        const expected = 5;
        const targetKeys = ["tl_y", "tl_x", "br_y", "br_x"];

        it("Expected at least " + expected + " zones.", function() {
            const results = frApi.getZones();
            expect(Object.entries(results).length).to.be.above(expected - 1);

            for (const key in results) {
                if (Object.prototype.hasOwnProperty.call(results, key)) { // guard-for-in
                    const zone = results[key];
                    expect(zone).to.include.all.keys(targetKeys);
                }
            }
        });
    });

    describe("Getting Flights", function() {
        const expected = 100;

        it("Expected at least " + expected + " flights.", async function() {
            const results = await frApi.getFlights();
            expect(results.length).to.be.above(expected - 1);
        });
    });

    describe("Getting Flight Details", function() {
        const targetKeys = ["airport", "airline", "aircraft", "time", "status", "trail"];

        it("Expected getting the following information: " + targetKeys.join(", ") + ".", async function() {
            const flights = await frApi.getFlights();
            const flight = flights[Math.trunc(flights.length / 2)];
            const details = await frApi.getFlightDetails(flight);
            expect(details).to.include.all.keys(targetKeys);
        });
    });

    describe("Getting Flights by Airline", function() {
        const expected = 3;
        const targetAirlines = ["SWA", "GLO", "AZU", "UAL", "THY"];

        let message = "Expected getting flights from at least " + expected;
        message += " of the following airlines: " + targetAirlines.join(", ") + ".";

        it(message, async function() {
            let count = 0;

            for (const airline of targetAirlines) {
                const flights = await frApi.getFlights(airline);

                for (const flight of flights) {
                    expect(flight.airlineIcao).to.be.equal(airline);
                }

                if (flights.length) count++;
            }
            expect(count).to.be.above(expected - 1);
        });
    });

    describe("Getting Flights by Bounds", function() {
        const expected = 30;
        const targetZones = ["northamerica", "southamerica"];

        it("Expected at least " + expected + " flights at: " + targetZones.join(", ") + ".", async function() {
            const zones = frApi.getZones();

            for (const zoneName of targetZones) {
                const zone = zones[zoneName];

                const bounds = frApi.getBounds(zone);
                const flights = await frApi.getFlights(null, bounds);

                for (const flight of flights) {
                    expect(flight.latitude).to.be.below(zone["tl_y"]);
                    expect(flight.latitude).to.be.above(zone["br_y"]);

                    expect(flight.longitude).to.be.below(zone["br_x"]);
                    expect(flight.longitude).to.be.above(zone["tl_x"]);
                }
                expect(flights.length).to.be.above(expected - 1);
            }
        });
    });

    describe("Getting Airline Logo", function() {
        const targetAirlines = [["WN", "SWA"], ["G3", "GLO"], ["AD", "AZU"], ["AA", "AAL"], ["TK", "THY"]];
        const expected = targetAirlines.length * 0.8;

        const icao = targetAirlines.map(a => a[1]);

        let message = "Expected getting logos from at least " + Math.trunc(expected);
        message += " of the following airlines: " + icao.join(", ") + ".";

        it(message, async function() {
            let found = 0;

            for (const airline of targetAirlines) {
                const result = await frApi.getAirlineLogo(airline[0], airline[1]);
                if (result != null && result[0].byteLength > 512) found++;
            }
            expect(found).to.be.above(expected - 1);
        });
    });

    describe("Getting Country Flag", function() {
        const targetCountries = ["United States", "Brazil", "Egypt", "Japan", "South Korea", "Canada"];
        const expected = targetCountries.length * 0.8;

        let message = "Expected getting flags from at least " + Math.trunc(expected);
        message += " of the following countries: " + targetCountries.join(", ") + ".";

        it(message, async function() {
            let found = 0;

            for (const country of targetCountries) {
                const result = await frApi.getCountryFlag(country);
                if (result != null && result[0].byteLength > 512) found++;
            }
            expect(found).to.be.above(expected - 1);
        });
    });

    describe("Getting Bounds by Point", function() {
        const expected = "52.58594974202871,52.54997688140807,13.253064418048115,13.3122478541492";

        it("Formula for calculating bounds is correct.", function() {
            const bounds = frApi.getBoundsByPoint(52.567967, 13.282644, 2000);
            expect(bounds).to.be.equal(expected);
        });
    });

    // --- Unit tests (no network) ---

    describe("getBounds()", function() {
        it("Converts zone dict to coordinate string.", function() {
            const zone = {"tl_y": 75.78, "br_y": -75.78, "tl_x": -427.56, "br_x": 427.56};
            expect(frApi.getBounds(zone)).to.equal("75.78,-75.78,-427.56,427.56");
        });
    });

    describe("getAirport() — invalid code", function() {
        it("Throws when airport code is too short.", async function() {
            try {
                await frApi.getAirport("X");
                expect.fail("Expected an error to be thrown.");
            }
            catch (err) {
                expect(err).to.be.instanceof(Error);
            }
        });
    });

    describe("setFlightTrackerConfig() — invalid key", function() {
        it("Throws when an unknown config key is set.", function() {
            expect(() => frApi.setFlightTrackerConfig(null, {unknownKey: "1"})).to.throw();
        });
    });

    describe("setFlightTrackerConfig() — invalid value", function() {
        it("Throws when a non-numeric value is set.", function() {
            expect(() => frApi.setFlightTrackerConfig(null, {limit: "not_a_number"})).to.throw();
        });
    });

    describe("Flight.checkInfo()", function() {
        const info = [
            "ABC123", -23.5, -46.6, 180, 35000, 450,
            "1234", null, "B738", "PR-ABC", 1620000000,
            "GRU", "GIG", "G31234", 0, 0, "GLO1234", null, "GLO",
        ];
        const flight = new Flight("123456789", info);

        it("Exact match returns true.", function() {
            expect(flight.checkInfo({altitude: 35000})).to.be.true;
        });

        it("Min/max range within bounds returns true.", function() {
            expect(flight.checkInfo({minAltitude: 30000, maxAltitude: 40000})).to.be.true;
        });

        it("Exact mismatch returns false.", function() {
            expect(flight.checkInfo({altitude: 40000})).to.be.false;
        });

        it("Max exceeded returns false.", function() {
            expect(flight.checkInfo({maxAltitude: 30000})).to.be.false;
        });

        it("String field match returns true.", function() {
            expect(flight.checkInfo({airlineIcao: "GLO"})).to.be.true;
        });

        it("String field mismatch returns false.", function() {
            expect(flight.checkInfo({airlineIcao: "TAM"})).to.be.false;
        });

        it("Combined conditions all matching returns true.", function() {
            expect(flight.checkInfo({minAltitude: 30000, maxAltitude: 40000, airlineIcao: "GLO"})).to.be.true;
        });
    });
});
