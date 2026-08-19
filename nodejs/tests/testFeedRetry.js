/**
 * Offline tests for the degraded-live-feed recovery in getFlights().
 *
 * A degraded FR24 feed backend answers 200 with a well-formed envelope but zero
 * flight entries, and the `AWSALB` cookie pins the session to it. These tests
 * pin down when getFlights() retries and when it must not, so the PR gate keeps
 * guarding the behaviour while FR24 is healthy.
 */
const expect = require("chai").expect;

const { FlightRadar24API } = require("../FlightRadarAPI/index");

// One real feed row, trimmed to the positional fields Flight actually reads.
const FLIGHT_ROW = [
    "ABC123", -23.43, -46.47, 90, 35000, 450, "1234", "", "B738", "PR-XYZ",
    1700000000, "GRU", "GIG", "G31234", 0, 0, "GLO1234", 0, "GLO",
];

const DEGRADED_FEED = {
    "full_count": 22684,
    "version": 4,
    "stats": { total: { "ads-b": 18541 }, visible: { "ads-b": 0 } },
};

const HEALTHY_FEED = {
    "full_count": 24560,
    "version": 4,
    "3f6a31cd": FLIGHT_ROW,
    "40ae422e": FLIGHT_ROW,
};

const IDLE_FEED = { "full_count": 0, "version": 4 };

/**
 * Swap in a client double that replays `responses` in order and records which
 * cookies getFlights() dropped between attempts.
 *
 * @param {Array<object>} responses - feed payload per call; the last one repeats
 * @return {{api: FlightRadar24API, calls: Array<object>, deleted: Array<string>}}
 */
function apiWithFeedResponses(responses) {
    const api = new FlightRadar24API();
    const calls = [];
    const deleted = [];

    api.__client = {
        async request(url, options) {
            calls.push({ url, options });
            const payload = responses[Math.min(calls.length - 1, responses.length - 1)];
            return { content: payload, statusCode: 200, cookies: {} };
        },
        deleteCookie(name) {
            deleted.push(name);
        },
    };
    return { api, calls, deleted };
}


describe("getFlights() degraded-feed recovery (offline)", function() {
    it("retries an empty feed and returns the flights from a healthy backend", async function() {
        const { api, calls, deleted } = apiWithFeedResponses([DEGRADED_FEED, HEALTHY_FEED]);

        const flights = await api.getFlights();

        expect(flights).to.have.lengthOf(2);
        expect(calls).to.have.lengthOf(2);
        // Without this the balancer routes the retry back to the same backend.
        expect(deleted).to.include("AWSALB");
        expect(deleted).to.include("AWSALBCORS");
    });

    it("keeps re-rolling while the feed stays empty, then gives up and returns []", async function() {
        const { api, calls } = apiWithFeedResponses([DEGRADED_FEED]);

        const flights = await api.getFlights();

        expect(flights).to.deep.equal([]);
        // A permanently degraded upstream must not loop forever.
        expect(calls.length).to.be.above(1);
        expect(calls.length).to.be.at.most(6);
    });

    it("does not retry when the feed reports nothing to track (full_count 0)", async function() {
        const { api, calls, deleted } = apiWithFeedResponses([IDLE_FEED]);

        const flights = await api.getFlights();

        expect(flights).to.deep.equal([]);
        expect(calls).to.have.lengthOf(1);
        expect(deleted).to.deep.equal([]);
    });

    it("does not retry a healthy first response", async function() {
        const { api, calls, deleted } = apiWithFeedResponses([HEALTHY_FEED]);

        const flights = await api.getFlights();

        expect(flights).to.have.lengthOf(2);
        expect(calls).to.have.lengthOf(1);
        expect(deleted).to.deep.equal([]);
    });

    it("passes the caller's filters unchanged on every retry", async function() {
        const { api, calls } = apiWithFeedResponses([DEGRADED_FEED, DEGRADED_FEED, HEALTHY_FEED]);

        await api.getFlights("GLO", "75,3,-180,-52");

        expect(calls).to.have.lengthOf(3);
        for (const call of calls) {
            expect(call.options.params).to.include({ airline: "GLO", bounds: "75,3,-180,-52" });
        }
    });
});


describe("Session.deleteCookie (offline)", function() {
    it("drops one cookie and leaves the rest of the jar intact", function() {
        const { Session } = require("../FlightRadarAPI/request");
        const session = new Session();

        session.__storeCookies("https://data-cloud.flightradar24.com/zones/fcgi/feed.js", [
            "AWSALB=sticky; Path=/",
            "_frPl=login-token; Path=/",
        ]);
        session.deleteCookie("AWSALB");

        expect(session.getCookie("AWSALB")).to.equal(undefined);
        // Shedding stickiness must not log the user out.
        expect(session.getCookie("_frPl")).to.equal("login-token");
    });

    it("is a no-op for a cookie that was never stored", function() {
        const { Session } = require("../FlightRadarAPI/request");
        const session = new Session();

        expect(() => session.deleteCookie("AWSALB")).to.not.throw();
    });
});
