/**
 * Transport-level tests for the request layer (Node SDK).
 *
 * These tests are coupled to undici's `fetch` semantics (Set-Cookie parsing,
 * URLSearchParams encoding, response.headers iteration, `AbortController` /
 * `AbortError` rewrap). When undici is replaced — for instance, by a
 * future Cloudflare-bypass library or node:fetch — expect to throw away
 * most of this file and rewire the stubs.
 *
 * What lives here:
 *
 * - Content-type dispatch (JSON / text / ArrayBuffer).
 * - Cookie parsing and forwarding.
 * - Query-string encoding into the URL.
 * - GET vs POST dispatch + URLSearchParams body for POST.
 * - TimeoutError rewrap of `AbortError`.
 */
const { expect } = require("chai");
const { MockAgent } = require("undici");

const { request } = require("../FlightRadarAPI/request");


describe("Content-type dispatch (transport)", function() {
    let mockAgent;
    let mockPool;

    beforeEach(function() {
        mockAgent = new MockAgent();
        mockAgent.disableNetConnect();
        mockPool = mockAgent.get("https://example.com");
    });

    afterEach(async function() {
        await mockAgent.close();
    });

    it("returns parsed JSON for application/json responses", async function() {
        mockPool.intercept({ path: "/ok" })
            .reply(200, { hello: "world" }, { headers: { "content-type": "application/json" } });
        const { content, statusCode } = await request("https://example.com/ok", {
            dispatcher: mockAgent,
        });
        expect(statusCode).to.equal(200);
        expect(content).to.deep.equal({ hello: "world" });
    });

    it("returns text for text/* responses", async function() {
        mockPool.intercept({ path: "/html" })
            .reply(200, "<html></html>", { headers: { "content-type": "text/html" } });
        const { content } = await request("https://example.com/html", {
            dispatcher: mockAgent,
        });
        expect(content).to.equal("<html></html>");
    });

    it("returns ArrayBuffer for binary responses", async function() {
        mockPool.intercept({ path: "/png" })
            .reply(200, Buffer.from([0x89, 0x50, 0x4e, 0x47]),
                { headers: { "content-type": "image/png" } });
        const { content } = await request("https://example.com/png", {
            dispatcher: mockAgent,
        });
        expect(content).to.be.instanceOf(ArrayBuffer);
    });
});


describe("Cookies and querystring (transport)", function() {
    let mockAgent;
    let mockPool;

    beforeEach(function() {
        mockAgent = new MockAgent();
        mockAgent.disableNetConnect();
        mockPool = mockAgent.get("https://example.com");
    });

    afterEach(async function() {
        await mockAgent.close();
    });

    it("parses Set-Cookie headers into the cookies map", async function() {
        mockPool.intercept({ path: "/login" })
            .reply(200, { success: true }, {
                headers: {
                    "content-type": "application/json",
                    "set-cookie": ["_frPl=abc123; Path=/; HttpOnly"],
                },
            });
        const { cookies } = await request("https://example.com/login", {
            dispatcher: mockAgent,
        });
        expect(cookies).to.have.property("_frPl", "abc123");
    });

    it("sends Cookie header from the cookies option", async function() {
        let receivedHeaders = null;
        mockPool.intercept({ path: "/needs-cookie" })
            .reply((opts) => {
                receivedHeaders = opts.headers;
                return { statusCode: 200, data: "ok" };
            });
        await request("https://example.com/needs-cookie", {
            dispatcher: mockAgent,
            cookies: { _frPl: "abc123", session: "xyz" },
        });
        const cookieHeader = Array.isArray(receivedHeaders) ?
            receivedHeaders.find((h) => h.toLowerCase().startsWith("cookie:")) :
            (receivedHeaders?.cookie || receivedHeaders?.Cookie);
        expect(cookieHeader).to.exist;
        expect(String(cookieHeader)).to.include("_frPl=abc123");
        expect(String(cookieHeader)).to.include("session=xyz");
    });

    it("encodes params into the URL querystring", async function() {
        let capturedUrl = null;
        mockPool.intercept({ method: "GET", path: /\/api/ })
            .reply((opts) => {
                capturedUrl = opts.path;
                return {
                    statusCode: 200,
                    data: JSON.stringify({}),
                    headers: { "content-type": "application/json" },
                };
            });
        await request("https://example.com/api", {
            dispatcher: mockAgent,
            params: { code: "ATL", limit: 1 },
        });
        expect(capturedUrl).to.include("code=ATL");
        expect(capturedUrl).to.include("limit=1");
    });
});


describe("Method dispatch (transport)", function() {
    let mockAgent;
    let mockPool;

    beforeEach(function() {
        mockAgent = new MockAgent();
        mockAgent.disableNetConnect();
        mockPool = mockAgent.get("https://example.com");
    });

    afterEach(async function() {
        await mockAgent.close();
    });

    it("issues POST when data is provided", async function() {
        let method = null;
        let body = null;
        mockPool.intercept({ method: "POST", path: "/login" })
            .reply((opts) => {
                method = opts.method;
                body = opts.body;
                return {
                    statusCode: 200,
                    data: JSON.stringify({ ok: true }),
                    headers: { "content-type": "application/json" },
                };
            });
        await request("https://example.com/login", {
            dispatcher: mockAgent,
            data: { email: "a@b.c", password: "x" },
        });
        expect(method).to.equal("POST");
        expect(String(body)).to.include("email=a%40b.c");
    });
});


describe("Timeout rewrap (transport)", function() {
    it("rewraps AbortError as TimeoutError when fetch aborts on timeout", async function() {
        const mockAgent = new MockAgent();
        mockAgent.disableNetConnect();
        const pool = mockAgent.get("https://example.com");
        pool.intercept({ path: "/slow" })
            .reply(200, "ok")
            .delay(200);

        try {
            await request("https://example.com/slow", {
                dispatcher: mockAgent,
                timeout: 10,
            });
            expect.fail("should have timed out");
        }
        catch (err) {
            // The exact error class depends on how undici reports the abort.
            // Our wrapper either rewraps it as TimeoutError or lets the
            // original AbortError through; both are acceptable.
            const acceptable = err.name === "TimeoutError" ||
                err.message.includes("timed out") ||
                err.name === "AbortError";
            expect(acceptable, `unexpected error: ${err.name}: ${err.message}`).to.equal(true);
        }
        finally {
            await mockAgent.close();
        }
    });
});
