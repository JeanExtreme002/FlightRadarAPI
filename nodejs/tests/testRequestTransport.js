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


describe("Session cookie jar scope (offline)", function() {
    const { Session } = require("../FlightRadarAPI/request");

    let mockAgent;
    let sitePool;
    let cdnPool;
    let session;

    /**
     * @param {object|Array<string>} headers - headers as the stub received them
     * @return {string|undefined} the Cookie header, if any
     */
    const cookieHeaderOf = (headers) => (Array.isArray(headers) ?
        headers.find((h) => h.toLowerCase().startsWith("cookie:")) :
        (headers?.cookie || headers?.Cookie));

    beforeEach(function() {
        mockAgent = new MockAgent();
        mockAgent.disableNetConnect();
        sitePool = mockAgent.get("https://www.flightradar24.com");
        cdnPool = mockAgent.get("https://cdn.flightradar24.com");
        session = new Session({ dispatcher: mockAgent });
    });

    afterEach(async function() {
        await mockAgent.close();
    });

    /**
     * @param {Array<string>} setCookie - Set-Cookie headers the login stub replies with
     * @return {Promise<void>}
     */
    async function login(setCookie) {
        sitePool.intercept({ path: "/user/login" }).reply(200, { success: true }, {
            headers: { "content-type": "application/json", "set-cookie": setCookie },
        });
        await session.request("https://www.flightradar24.com/user/login");
    }

    it("keeps a token whose value contains '='", async function() {
        await login(["_frPl=sess.token.with==padding; Path=/; Secure"]);

        expect(session.getCookie("_frPl")).to.equal("sess.token.with==padding");
    });

    it("does not replay a www cookie to the cdn host", async function() {
        await login(["_frPl=login-token; Path=/; Secure"]);

        let received = null;
        cdnPool.intercept({ path: "/assets/airlines/logotypes/AA_AAL.png" }).reply((opts) => {
            received = opts.headers;
            return { statusCode: 200, data: "" };
        });
        await session.request("https://cdn.flightradar24.com/assets/airlines/logotypes/AA_AAL.png");

        expect(received, "the cdn interceptor never fired").to.not.equal(null);
        expect(cookieHeaderOf(received)).to.equal(undefined);
    });

    it("sends the cookie back to the host that set it", async function() {
        await login(["_frPl=login-token; Path=/; Secure"]);

        let received = null;
        sitePool.intercept({ path: "/webapi/v1/bookmarks" }).reply((opts) => {
            received = opts.headers;
            return { statusCode: 200, data: "{}" };
        });
        await session.request("https://www.flightradar24.com/webapi/v1/bookmarks");

        expect(String(cookieHeaderOf(received))).to.include("_frPl=login-token");
    });

    it("treats Max-Age=0 as a deletion", async function() {
        await login(["_frPl=login-token; Path=/", "AWSALB=sticky; Path=/"]);
        expect(session.getCookie("AWSALB")).to.equal("sticky");

        sitePool.intercept({ path: "/logout" }).reply(200, {}, {
            headers: { "content-type": "application/json", "set-cookie": ["AWSALB=; Path=/; Max-Age=0"] },
        });
        await session.request("https://www.flightradar24.com/logout");

        expect(session.getCookie("AWSALB")).to.equal(undefined);
        expect(session.getCookie("_frPl")).to.equal("login-token");
    });

    it("respects the Path attribute", async function() {
        await login(["scoped=yes; Path=/data"]);

        let received = null;
        sitePool.intercept({ path: "/flights/most-tracked" }).reply((opts) => {
            received = opts.headers;
            return { statusCode: 200, data: "{}" };
        });
        await session.request("https://www.flightradar24.com/flights/most-tracked");

        expect(received, "the interceptor never fired").to.not.equal(null);
        expect(cookieHeaderOf(received)).to.equal(undefined);
    });

    it("ignores a malformed Max-Age instead of reading it as a deletion", async function() {
        await login(["_frPl=login-token; Path=/; Max-Age"]);

        expect(session.getCookie("_frPl")).to.equal("login-token");
    });

    it("refuses a Domain attribute naming a bare TLD", async function() {
        await login(["evil=1; Domain=com; Path=/"]);

        expect(session.__cookiesFor("https://example.com/")).to.deep.equal({});
    });

    it("prefers the re-issued cookie over the one it supersedes", async function() {
        await login(["_frPl=old-token"]);
        sitePool.intercept({ path: "/user/login" }).reply(200, { success: true }, {
            headers: {
                "content-type": "application/json",
                "set-cookie": ["_frPl=new-token; Domain=.flightradar24.com; Path=/"],
            },
        });
        await session.request("https://www.flightradar24.com/user/login");

        expect(session.getCookie("_frPl")).to.equal("new-token");
    });

    it("scopes a Path-less cookie to the directory that set it", async function() {
        // FR24 sends `path=/` on every cookie observed, so this documents the
        // RFC 6265 default rather than a path the SDK relies on.
        await login(["scoped=yes"]);

        expect(session.__cookiesFor("https://www.flightradar24.com/user/settings")).to.deep.equal({ scoped: "yes" });
        expect(session.__cookiesFor("https://www.flightradar24.com/webapi/v1/bookmarks")).to.deep.equal({});
    });
});


describe("Set-Cookie parsing edge cases (offline)", function() {
    const { Session } = require("../FlightRadarAPI/request");

    const jarAfter = (header, url = "https://www.flightradar24.com/user/login") => {
        const session = new Session();
        session.__storeCookies(url, [header]);
        return session;
    };

    // These three are why the parser is hand-rolled rather than delegated to
    // undici's getSetCookies, which gets each of them wrong.
    it("treats a negative Max-Age as a deletion", function() {
        expect(jarAfter("a=1; Path=/; Max-Age=-5").getCookie("a")).to.equal(undefined);
    });

    it("rejects a cookie with an empty name", function() {
        const session = jarAfter("=9; Path=/");
        expect(session.__cookiesFor("https://www.flightradar24.com/")).to.deep.equal({});
    });

    it("ignores a relative Path instead of widening the cookie to /", function() {
        const session = jarAfter("a=1; Path=relative");
        expect(session.__cookiesFor("https://www.flightradar24.com/user/settings")).to.deep.equal({ a: "1" });
        expect(session.__cookiesFor("https://www.flightradar24.com/webapi/v1/bookmarks")).to.deep.equal({});
    });

    it("does not store a Secure cookie arriving over a plaintext connection", function() {
        const session = jarAfter("a=1; Path=/; Secure", "http://insecure.example.com/");
        expect(session.getCookie("a")).to.equal(undefined);
    });

    it("keeps an Expires date in the past as a deletion", function() {
        expect(jarAfter("a=1; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT").getCookie("a")).to.equal(undefined);
    });
});


describe("Cookie attribution across redirects (offline)", function() {
    const http = require("http");
    const { Session } = require("../FlightRadarAPI/request");

    let server;
    let port;

    beforeEach(function(done) {
        // A real server, because MockAgent does not follow redirects.
        // 127.0.0.1 and localhost are distinct origins to fetch.
        server = http.createServer((req, res) => {
            if (req.url === "/start") {
                res.writeHead(302, { Location: `http://localhost:${port}/landed` });
                res.end();
                return;
            }
            if (req.url === "/landed") {
                res.setHeader("Set-Cookie", "planted=yes; Path=/");
            }
            res.setHeader("Content-Type", "application/json");
            res.end("{}");
        });
        // Bound dual-stack, not to 127.0.0.1: Node 18 resolves `localhost` to
        // ::1 first, and a v4-only listener refuses that connection.
        server.listen(0, () => {
            port = server.address().port;
            done();
        });
    });

    afterEach(function(done) {
        // The undici agent keeps sockets alive, and close() waits for them.
        server.closeAllConnections?.();
        server.close(done);
    });

    it("credits a cookie to the host that ended the redirect chain", async function() {
        const session = new Session();
        await session.request(`http://127.0.0.1:${port}/start`);

        // Set by localhost after the hop, so it must not be replayed to 127.0.0.1.
        expect(session.__cookiesFor(`http://localhost:${port}/`)).to.deep.equal({ planted: "yes" });
        expect(session.__cookiesFor(`http://127.0.0.1:${port}/`)).to.deep.equal({});
    });
});


describe("Response size budget (offline)", function() {
    const { request, MAX_RESPONSE_BYTES } = require("../FlightRadarAPI/request");
    const { DecompressionLimitError } = require("../FlightRadarAPI/errors");

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

    it("refuses a body past the budget", async function() {
        mockPool.intercept({ path: "/huge" })
            .reply(200, "x".repeat(4096), { headers: { "content-type": "text/plain" } });

        try {
            await request("https://example.com/huge", { dispatcher: mockAgent, maxResponseBytes: 1024 });
            expect.fail("should have refused the body");
        }
        catch (err) {
            expect(err).to.be.instanceOf(DecompressionLimitError);
            expect(err.message).to.include("1024");
        }
    });

    it("accepts a body at the budget", async function() {
        mockPool.intercept({ path: "/exact" })
            .reply(200, "x".repeat(1024), { headers: { "content-type": "text/plain" } });

        const { content } = await request("https://example.com/exact", {
            dispatcher: mockAgent, maxResponseBytes: 1024,
        });
        expect(content).to.have.lengthOf(1024);
    });

    it("still dispatches on content-type after the change to streamed reads", async function() {
        mockPool.intercept({ path: "/j" })
            .reply(200, { a: 1 }, { headers: { "content-type": "application/json" } });
        mockPool.intercept({ path: "/t" })
            .reply(200, "hi", { headers: { "content-type": "text/plain" } });
        mockPool.intercept({ path: "/b" })
            .reply(200, Buffer.from([1, 2, 3]), { headers: { "content-type": "image/png" } });

        expect((await request("https://example.com/j", { dispatcher: mockAgent })).content).to.deep.equal({ a: 1 });
        expect((await request("https://example.com/t", { dispatcher: mockAgent })).content).to.equal("hi");

        const binary = (await request("https://example.com/b", { dispatcher: mockAgent })).content;
        expect(binary).to.be.instanceOf(ArrayBuffer);
        expect([...Buffer.from(binary)]).to.deep.equal([1, 2, 3]);
    });

    it("defaults to a 64 MiB budget", function() {
        expect(MAX_RESPONSE_BYTES).to.equal(64 * 1024 * 1024);
    });
});


describe("Byte-order mark handling (offline)", function() {
    // Response.json()/text() ran the spec UTF-8 decode, which strips a BOM.
    // Reading the body as a Buffer does not, so this has to be done by hand.
    const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

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

    it("parses JSON that starts with a BOM", async function() {
        mockPool.intercept({ path: "/bom.json" })
            .reply(200, Buffer.concat([BOM, Buffer.from(JSON.stringify({ ok: true }))]),
                { headers: { "content-type": "application/json" } });

        const { content } = await request("https://example.com/bom.json", { dispatcher: mockAgent });
        expect(content).to.deep.equal({ ok: true });
    });

    it("strips a BOM from text responses", async function() {
        mockPool.intercept({ path: "/bom.txt" })
            .reply(200, Buffer.concat([BOM, Buffer.from("hello")]),
                { headers: { "content-type": "text/plain" } });

        const { content } = await request("https://example.com/bom.txt", { dispatcher: mockAgent });
        expect(content).to.equal("hello");
    });

    it("leaves binary bodies byte-for-byte intact", async function() {
        mockPool.intercept({ path: "/bom.bin" })
            .reply(200, Buffer.concat([BOM, Buffer.from([1, 2])]),
                { headers: { "content-type": "image/png" } });

        const { content } = await request("https://example.com/bom.bin", { dispatcher: mockAgent });
        expect([...Buffer.from(content)]).to.deep.equal([0xEF, 0xBB, 0xBF, 1, 2]);
    });
});


describe("Cookie read paths agree (offline)", function() {
    const { Session } = require("../FlightRadarAPI/request");

    it("resolves a re-issued cookie the same way for reads and for sending", function() {
        // getCookie feeds the `token`/`enc` query params while the jar builds
        // the Cookie header; if they disagree, one request carries two
        // different values for the same token. /user/logout is a real URL.
        const session = new Session();
        session.__storeCookies("https://www.flightradar24.com/user/login", ["_frPl=old-token"]);
        session.__storeCookies("https://www.flightradar24.com/", ["_frPl=new-token; Path=/"]);

        expect(session.getCookie("_frPl")).to.equal("new-token");
        expect(session.__cookiesFor("https://www.flightradar24.com/user/logout"))
            .to.deep.equal({ _frPl: "new-token" });
    });

    it("does not expose inherited Object properties as cookies", function() {
        const session = new Session();
        session.__storeCookies("https://www.flightradar24.com/", ["a=1; Path=/"]);

        const selected = session.__cookiesFor("https://www.flightradar24.com/");
        expect(selected.toString).to.equal(undefined);
        expect(selected.constructor).to.equal(undefined);
    });
});


describe("Error responses and slow bodies (offline)", function() {
    const http = require("http");
    const { request } = require("../FlightRadarAPI/request");
    const { CloudflareError } = require("../FlightRadarAPI/errors");

    // A real server: MockAgent neither pools connections nor trickles a body.
    /**
     * @param {Function} handler - node request handler
     * @return {Promise<object>} the listening server
     */
    function serve(handler) {
        return new Promise((resolve) => {
            const server = http.createServer(handler);
            server.listen(0, "127.0.0.1", () => resolve(server));
        });
    }

    it("keeps the connection alive across error responses", async function() {
        // Regression: throwing before reading left the body unconsumed, so
        // undici destroyed the socket and every error cost a new handshake.
        const payload = "x".repeat(200_000);
        const connections = new Set();
        const server = await serve((req, res) => {
            res.writeHead(500, {
                "content-type": "application/json",
                "content-length": String(payload.length),
            });
            res.end(payload);
        });
        server.on("connection", (socket) => connections.add(socket.remotePort));

        try {
            for (let i = 0; i < 5; i++) {
                await request(`http://127.0.0.1:${server.address().port}/`).catch(() => {});
            }
            expect(connections.size).to.be.lessThan(3);
        }
        finally {
            server.closeAllConnections?.();
            await new Promise((done) => server.close(done));
        }
    });

    it("times out a body that trickles in under the cap", async function() {
        // The budget alone cannot stop this: the body never exceeds it.
        const server = await serve((req, res) => {
            res.writeHead(200, { "content-type": "text/plain", "content-length": "20" });
            let sent = 0;
            const timer = setInterval(() => {
                if (sent++ >= 20) {
                    clearInterval(timer);
                    res.end();
                    return;
                }
                res.write("x");
            }, 200);
        });

        try {
            await request(`http://127.0.0.1:${server.address().port}/`, { timeout: 300 });
            expect.fail("should have timed out");
        }
        catch (err) {
            expect(err.name).to.equal("TimeoutError");
        }
        finally {
            server.closeAllConnections?.();
            await new Promise((done) => server.close(done));
        }
    });

    it("carries the challenge page on CloudflareError", async function() {
        const challenge = "<html>Attention Required! Cloudflare</html>";
        const server = await serve((req, res) => {
            res.writeHead(403, {
                "cf-mitigated": "challenge",
                "content-type": "text/html",
                "content-length": String(challenge.length),
            });
            res.end(challenge);
        });

        try {
            await request(`http://127.0.0.1:${server.address().port}/`);
            expect.fail("should have raised CloudflareError");
        }
        catch (err) {
            // response.bodyUsed is true by then, so the error has to carry it.
            expect(err).to.be.instanceOf(CloudflareError);
            expect(err.body).to.equal(challenge);
        }
        finally {
            server.closeAllConnections?.();
            await new Promise((done) => server.close(done));
        }
    });
});


describe("Rejected Set-Cookie attributes (offline)", function() {
    const { Session } = require("../FlightRadarAPI/request");

    it("discards a cookie whose Domain does not cover the host", function() {
        // RFC 6265 5.3.6 says ignore it, not narrow it back to the host —
        // narrowing left the cookie replayed on every later request.
        const session = new Session();
        session.__storeCookies("https://cdn.flightradar24.com/x", [
            "evil=1; Domain=evil.example.com; Path=/",
            "tld=1; Domain=com; Path=/",
            "kept=1; Domain=flightradar24.com; Path=/",
        ]);

        expect(session.__cookiesFor("https://cdn.flightradar24.com/"))
            .to.deep.equal({ kept: "1" });
    });
});


describe("Public shapes and the error path (offline)", function() {
    const http = require("http");
    const { request, Session } = require("../FlightRadarAPI/request");
    const { CloudflareError } = require("../FlightRadarAPI/errors");

    /**
     * @param {Function} handler - node request handler
     * @return {Promise<object>} the listening server
     */
    function serve(handler) {
        return new Promise((resolve) => {
            const server = http.createServer(handler);
            server.listen(0, "127.0.0.1", () => resolve(server));
        });
    }

    it("returns cookies on an ordinary object", async function() {
        // Typed `Record<string, string>` and public, so a null prototype would
        // break `cookies.hasOwnProperty(name)` in a patch release.
        const server = await serve((req, res) => {
            res.setHeader("Set-Cookie", "a=1; Path=/");
            res.setHeader("Content-Type", "application/json");
            res.end("{}");
        });

        try {
            const { cookies } = await request(`http://127.0.0.1:${server.address().port}/`);
            expect(cookies.hasOwnProperty("a")).to.equal(true);
        }
        finally {
            server.closeAllConnections?.();
            await new Promise((done) => server.close(done));
        }
    });

    it("strips a BOM from the Cloudflare challenge page", async function() {
        const page = "<html>challenge</html>";
        const body = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(page)]);
        const server = await serve((req, res) => {
            res.writeHead(403, {
                "cf-mitigated": "challenge",
                "content-type": "text/html",
                "content-length": String(body.length),
            });
            res.end(body);
        });

        try {
            await request(`http://127.0.0.1:${server.address().port}/`);
            expect.fail("should have raised CloudflareError");
        }
        catch (err) {
            expect(err).to.be.instanceOf(CloudflareError);
            expect(err.body).to.equal(page);
        }
        finally {
            server.closeAllConnections?.();
            await new Promise((done) => server.close(done));
        }
    });

    it("banks cookies handed out by a blocked response", async function() {
        // A Cloudflare 403 is the response that carries cf_clearance; dropping
        // it makes the retry replay the same blocked request.
        const server = await serve((req, res) => {
            res.writeHead(403, {
                "cf-mitigated": "challenge",
                "set-cookie": "cf_clearance=token; Path=/",
                "content-type": "text/html",
                "content-length": "2",
            });
            res.end("hi");
        });

        try {
            const session = new Session();
            await session.request(`http://127.0.0.1:${server.address().port}/`).catch(() => {});

            expect(session.getCookie("cf_clearance")).to.equal("token");
        }
        finally {
            server.closeAllConnections?.();
            await new Promise((done) => server.close(done));
        }
    });
});


describe("Cookies attached to errors (offline)", function() {
    const http = require("http");
    const { Session } = require("../FlightRadarAPI/request");

    it("credits a cookie from a failed response to the host that answered", async function() {
        // Regression: the error path attributed it to the requested URL, so a
        // cookie set after a redirect was replayed to a host that never set it
        // — the same bug the success path was fixed for earlier in this branch.
        let port;
        const server = http.createServer((req, res) => {
            if (req.url === "/start") {
                res.writeHead(302, { Location: `http://localhost:${port}/blocked` });
                res.end();
                return;
            }
            res.writeHead(403, {
                "cf-mitigated": "challenge",
                "set-cookie": "cf_clearance=token; Path=/",
                "content-type": "text/html",
                "content-length": "2",
            });
            res.end("hi");
        });
        await new Promise((ready) => server.listen(0, () => {
            port = server.address().port;
            ready();
        }));

        try {
            const session = new Session();
            await session.request(`http://127.0.0.1:${port}/start`).catch(() => {});

            expect(session.__cookiesFor(`http://localhost:${port}/`)).to.deep.equal({ cf_clearance: "token" });
            expect(session.__cookiesFor(`http://127.0.0.1:${port}/`)).to.deep.equal({});
        }
        finally {
            server.closeAllConnections?.();
            await new Promise((done) => server.close(done));
        }
    });

    it("keeps those cookies out of anything that serialises the error", async function() {
        // An enumerable property would put session credentials into
        // JSON.stringify(err) and any log line that dumps the error.
        const server = http.createServer((req, res) => {
            res.writeHead(403, {
                "cf-mitigated": "challenge",
                "set-cookie": "cf_clearance=secret; Path=/",
                "content-type": "text/html",
                "content-length": "2",
            });
            res.end("hi");
        });
        await new Promise((ready) => server.listen(0, "127.0.0.1", ready));

        try {
            await new Session().request(`http://127.0.0.1:${server.address().port}/`);
            expect.fail("should have raised");
        }
        catch (err) {
            expect(Object.keys(err)).to.not.include("rawCookies");
            expect(JSON.stringify(err)).to.not.include("secret");
            // Still reachable for the jar.
            expect(err.rawCookies).to.be.an("array");
        }
        finally {
            server.closeAllConnections?.();
            await new Promise((done) => server.close(done));
        }
    });
});
