/**
 * Offline tests for getFlightHistory(), against canned FR24 answers.
 */
const expect = require("chai").expect;

const { FlightRadar24API } = require("../FlightRadarAPI/index");
const Core = require("../FlightRadarAPI/core");

const HISTORY = { "result": { "response": {
    "item": { "current": 1, "total": null, "limit": 100 },
    "page": { "current": 1, "more": false, "total": null },
    "data": [{
        "identification": { "id": "42a4afc2", "number": { "default": "SQ306" } },
        "status": { "text": "Landed 07:52" },
        "aircraft": { "model": { "code": "A359" }, "registration": "9V-SJD" },
        "airport": { "origin": { "code": { "iata": "SIN" } }, "destination": { "code": { "iata": "LHR" } } },
        "time": { "scheduled": { "departure": 1795077000, "arrival": 1795129200 } },
    }],
} } };

const badRequest = (parameters) => ({ "errors": { "message": "Invalid parameters", "errors": { parameters } } });

/**
 * Swap in a client double that answers every request with the given payload.
 *
 * @param {object} [options]
 * @param {number} [options.statusCode=200]
 * @param {object} [options.content=HISTORY]
 * @param {boolean} [options.loggedIn=false]
 * @return {{api: FlightRadar24API, calls: Array<object>}}
 */
function apiAnswering({ statusCode = 200, content = HISTORY, loggedIn = false } = {}) {
    const api = new FlightRadar24API();
    const calls = [];

    api.__client = {
        request: async (url, options = {}) => {
            calls.push({ url, options });
            return { content: structuredClone(content), statusCode, cookies: {} };
        },
        getCookie: (name) => (name === "_frPl" ? "session-token" : undefined),
    };
    if (loggedIn) api.__loginData = { "userData": {} };

    return { api, calls };
}

describe("getFlightHistory() — offline", function() {
    it("returns the response block", async function() {
        const { api, calls } = apiAnswering();

        const history = await api.getFlightHistory("SQ306", 10, 2);

        expect(history["data"][0]["identification"]["id"]).to.equal("42a4afc2");
        expect(history["page"]["more"]).to.equal(false);
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].url).to.equal(Core.flightListUrl);
        expect(calls[0].options.params).to.deep.equal({ "query": "SQ306", "fetchBy": "flight", "limit": 10, "page": 2 });
    });

    it("always returns a list of flights", async function() {
        for (const response of [{ "data": null }, { "aircraftInfo": null }]) {
            const { api } = apiAnswering({ content: { "result": { response } } });

            expect((await api.getFlightHistory("ZZ9999"))["data"]).to.deep.equal([]);
        }
    });

    it("sends the session token when logged in", async function() {
        const { api, calls } = apiAnswering({ loggedIn: true });

        await api.getFlightHistory("SQ306");

        expect(calls[0].options.params["token"]).to.equal("session-token");
    });

    it("reports a limit out of range", async function() {
        const { api } = apiAnswering({
            statusCode: 400,
            content: badRequest({ "limit": { "notBetween": "The input is not between '1' and '100'" } }),
        });

        try {
            await api.getFlightHistory("SQ306", 500);
            expect.fail("expected a RangeError");
        }
        catch (error) {
            expect(error).to.be.instanceOf(RangeError);
            expect(error.message).to.include("between '1' and '100'");
        }
    });

    it("reports an invalid number", async function() {
        const { api } = apiAnswering({
            statusCode: 400,
            content: badRequest({ "query": { "stringLengthTooShort": "less than 3 characters" } }),
        });

        try {
            await api.getFlightHistory("S");
            expect.fail("expected a TypeError");
        }
        catch (error) {
            expect(error).to.be.instanceOf(TypeError);
            expect(error.message).to.include("'S'");
        }
    });
});
