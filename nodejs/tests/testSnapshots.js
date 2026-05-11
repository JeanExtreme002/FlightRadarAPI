const { FlightRadar24API, Countries } = require("..");
const expect = require("chai").expect;


/**
 * Recursively asserts that `actual` contains all keys described in `shape`.
 *
 * Shape leaf values:
 *   null        — key must exist; value may be anything including null
 *   "string"    — key must exist and typeof value must equal "string"
 *   {}          — key must be a non-null object with at least these nested keys
 *   []          — key must be an array; [elementShape] also checks first element
 *
 * @param {*} actual
 * @param {*} shape
 * @param {string} path
 */
function assertShape(actual, shape, path = "root") {
    if (shape === null) {
        expect(actual, `key missing at "${path}"`).to.not.equal(undefined);
        return;
    }
    if (typeof shape === "string") {
        expect(typeof actual, `type mismatch at "${path}": expected "${shape}", got "${typeof actual}"`).to.equal(shape);
        return;
    }
    if (Array.isArray(shape)) {
        expect(actual, `"${path}" must be an array`).to.be.an("array");
        if (shape.length > 0 && actual.length > 0) {
            assertShape(actual[0], shape[0], `${path}[0]`);
        }
        return;
    }
    expect(actual, `"${path}" must be a non-null object`).to.be.an("object").and.not.equal(null);
    for (const key of Object.keys(shape)) {
        expect(actual, `missing key "${key}" at "${path}"`).to.have.property(key);
        assertShape(actual[key], shape[key], `${path}.${key}`);
    }
}


// --- Shape descriptors ---
// Leaf null  → key must exist, any value
// Leaf type  → key must exist with that typeof
// Nested {}  → recurse
// []         → array; [s] also checks first element against s

const FLIGHT_SHAPE = {
    id: "string",
    icao24bit: null,
    latitude: null,
    longitude: null,
    heading: null,
    altitude: null,
    groundSpeed: null,
    squawk: null,
    aircraftCode: null,
    registration: null,
    time: null,
    originAirportIata: null,
    destinationAirportIata: null,
    number: null,
    airlineIata: null,
    onGround: null,
    verticalSpeed: null,
    callsign: null,
    airlineIcao: null,
};

const FLIGHT_DETAILS_SHAPE = {
    aircraft: null,
    airline: null,
    airport: {
        destination: null,
        origin: null,
    },
    status: {
        icon: null,
        text: null,
    },
    time: null,
    trail: [],
};

const AIRPORT_SHAPE = {
    name: null,
    icao: null,
    iata: null,
    country: null,
    latitude: null,
    longitude: null,
    altitude: null,
};

const AIRPORT_DETAILS_SHAPE = {
    airport: {
        pluginData: {
            details: {
                code: {
                    iata: null,
                    icao: null,
                },
                name: null,
                position: {
                    country: { name: null },
                    latitude: null,
                    longitude: null,
                },
                timezone: {
                    name: null,
                    offset: null,
                },
            },
        },
    },
    airlines: null,
    aircraftImages: null,
};

const AIRLINE_SHAPE = {
    Name: null,
    ICAO: null,
    IATA: null,
    n_aircrafts: null,
};

const ZONE_SHAPE = {
    tl_y: "number",
    tl_x: "number",
    br_y: "number",
    br_x: "number",
};


// --- Tests ---

describe("Snapshot Tests", function() {
    const frApi = new FlightRadar24API();
    let flights;

    before(async function() {
        flights = await frApi.getFlights();
        expect(flights.length, "getFlights() returned no flights — subsequent tests will be meaningless").to.be.above(0);
    });

    describe("getFlights()", function() {
        it("Flight instances match expected shape.", function() {
            expect(flights.length).to.be.above(0);
            assertShape(flights[0], FLIGHT_SHAPE);
        });
    });

    describe("getFlightDetails()", function() {
        it("Flight details response matches expected shape.", async function() {
            const flight = flights[Math.trunc(flights.length / 2)];
            const details = await frApi.getFlightDetails(flight);
            assertShape(details, FLIGHT_DETAILS_SHAPE);
        });
    });

    describe("getAirport()", function() {
        it("Airport instance matches expected shape.", async function() {
            const airport = await frApi.getAirport("ATL");
            assertShape(airport, AIRPORT_SHAPE);
        });
    });

    describe("getAirportDetails()", function() {
        it("Airport details response matches expected shape.", async function() {
            const details = await frApi.getAirportDetails("ATL", 1);
            assertShape(details, AIRPORT_DETAILS_SHAPE);
        });
    });

    describe("getAirlines()", function() {
        it("Airline objects match expected shape.", async function() {
            const airlines = await frApi.getAirlines();
            expect(airlines.length).to.be.above(0);
            assertShape(airlines[0], AIRLINE_SHAPE);
        });
    });

    describe("getAirlineLogo()", function() {
        it("Airline logo response is [ArrayBuffer, string] or null.", async function() {
            const result = await frApi.getAirlineLogo("G3", "GLO");
            if (result !== null) {
                expect(result).to.be.an("array").with.lengthOf(2);
                expect(result[0]).to.be.instanceof(ArrayBuffer);
                expect(result[1]).to.be.a("string").with.length.above(0);
            }
        });
    });

    describe("getAirports()", function() {
        it("Airport list items match expected shape.", async function() {
            const airports = await frApi.getAirports([Countries.BRAZIL]);
            expect(airports.length).to.be.above(0);
            assertShape(airports[0], AIRPORT_SHAPE);
        });
    });

    describe("getZones()", function() {
        it("Zone objects match expected shape.", function() {
            const zones = frApi.getZones();
            const zoneValues = Object.values(zones);
            expect(zoneValues.length).to.be.above(0);
            for (const zone of zoneValues) {
                assertShape(zone, ZONE_SHAPE);
            }
        });
    });

    describe("getCountryFlag()", function() {
        it("Country flag response is [ArrayBuffer, string] or null.", async function() {
            const result = await frApi.getCountryFlag("Brazil");
            if (result !== null) {
                expect(result).to.be.an("array").with.lengthOf(2);
                expect(result[0]).to.be.instanceof(ArrayBuffer);
                expect(result[1]).to.be.a("string").with.length.above(0);
            }
        });
    });

    describe("getMostTracked()", function() {
        it("Most tracked response is a non-null object.", async function() {
            const result = await frApi.getMostTracked();
            expect(result).to.be.an("object").and.not.equal(null);
        });
    });

    describe("getAirportDisruptions()", function() {
        it("Airport disruptions response is a non-null object.", async function() {
            const result = await frApi.getAirportDisruptions();
            expect(result).to.be.an("object").and.not.equal(null);
        });
    });

    describe("getVolcanicEruptions()", function() {
        it("Volcanic eruptions response is a non-null object.", async function() {
            const result = await frApi.getVolcanicEruptions();
            expect(result).to.be.an("object").and.not.equal(null);
        });
    });

    describe("search()", function() {
        it("Search response is a dictionary of result arrays.", async function() {
            const result = await frApi.search("Guarulhos");
            expect(result).to.be.an("object").and.not.equal(null);
            for (const key of Object.keys(result)) {
                expect(result[key], `search key "${key}" must be an array`).to.be.an("array");
            }
        });
    });
});
