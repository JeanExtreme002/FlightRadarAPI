/**
 * Policy-level tests for the request layer (Node SDK).
 *
 * These tests validate product rules that must hold regardless of which
 * HTTP library is in use:
 *
 * - `RetryPolicy` math (exponential backoff, jitter bounds, validation).
 * - `runWithRetry` semantics (when to retry, when to give up, which
 *   exception escapes).
 * - Cloudflare-block detection (HTTP 520, HTTP 403 with `cf-mitigated`,
 *   and the deliberate refusal to flag bare 403 from the FR24 origin).
 *
 * When `undici` is one day swapped for another transport, these assertions
 * should remain valid — only the MockAgent setup will need rewiring.
 */
const { expect } = require("chai");
const { MockAgent } = require("undici");

const { request, RetryPolicy, APIClient } = require("../FlightRadar24/request");
const { CloudflareError } = require("../FlightRadar24/errors");
const { clientWithFakeSession } = require("./_requestDoubles");


describe("RetryPolicy (policy)", function() {
    it("rejects maxAttempts < 1", function() {
        expect(() => new RetryPolicy({ maxAttempts: 0 })).to.throw();
    });

    it("rejects negative timing params", function() {
        expect(() => new RetryPolicy({ baseDelayMs: -1 })).to.throw();
        expect(() => new RetryPolicy({ maxDelayMs: -1 })).to.throw();
        expect(() => new RetryPolicy({ jitterMs: -1 })).to.throw();
    });

    it("sleepFor grows exponentially then caps at maxDelayMs", function() {
        const p = new RetryPolicy({
            maxAttempts: 10, baseDelayMs: 1000, maxDelayMs: 4000, jitterMs: 0,
        });
        expect(p.sleepFor(0)).to.equal(1000);
        expect(p.sleepFor(1)).to.equal(2000);
        expect(p.sleepFor(2)).to.equal(4000);
        expect(p.sleepFor(3)).to.equal(4000);
        expect(p.sleepFor(10)).to.equal(4000);
    });

    it("sleepFor adds bounded jitter", function() {
        const p = new RetryPolicy({
            maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 10_000, jitterMs: 500,
        });
        for (let i = 0; i < 50; i++) {
            const delay = p.sleepFor(0);
            expect(delay).to.be.at.least(1000).and.below(1500);
        }
    });
});


describe("APIClient retry wiring (policy)", function() {
    it("no retry policy = single attempt", async function() {
        const client = clientWithFakeSession(APIClient, () => {
            throw new CloudflareError("blocked", null);
        });
        try {
            await client.request("https://example.com");
            expect.fail("should have thrown");
        }
        catch (err) {
            expect(err).to.be.instanceOf(CloudflareError);
        }
        expect(client.__session.calls).to.equal(1);
    });

    it("retries CloudflareError and eventually succeeds", async function() {
        const retry = new RetryPolicy({
            maxAttempts: 5, baseDelayMs: 0, maxDelayMs: 0, jitterMs: 0,
        });
        let attempts = 0;
        const client = clientWithFakeSession(APIClient, () => {
            attempts++;
            if (attempts < 3) throw new CloudflareError("blocked", null);
            return { content: { ok: true }, statusCode: 200, cookies: {} };
        }, retry);
        const result = await client.request("https://example.com");
        expect(result.content).to.deep.equal({ ok: true });
        expect(attempts).to.equal(3);
    });

    it("throws the last error after exhausting attempts", async function() {
        const retry = new RetryPolicy({
            maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, jitterMs: 0,
        });
        let attempts = 0;
        const client = clientWithFakeSession(APIClient, () => {
            attempts++;
            throw new CloudflareError(`failure-${attempts}`, null);
        }, retry);
        try {
            await client.request("https://example.com");
            expect.fail("should have thrown");
        }
        catch (err) {
            expect(err).to.be.instanceOf(CloudflareError);
            expect(err.message).to.equal("failure-3");
        }
        expect(attempts).to.equal(3);
    });

    it("does not retry permanent (non-transient) errors", async function() {
        const retry = new RetryPolicy({
            maxAttempts: 5, baseDelayMs: 0, maxDelayMs: 0, jitterMs: 0,
        });
        let attempts = 0;
        const client = clientWithFakeSession(APIClient, () => {
            attempts++;
            throw new Error("permanent / not transient");
        }, retry);
        try {
            await client.request("https://example.com");
            expect.fail("should have thrown");
        }
        catch (err) {
            expect(err.message).to.include("permanent");
        }
        expect(attempts).to.equal(1);
    });

    it("retries on AbortError (treated as transient)", async function() {
        const retry = new RetryPolicy({
            maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, jitterMs: 0,
        });
        let attempts = 0;
        const client = clientWithFakeSession(APIClient, () => {
            attempts++;
            if (attempts < 2) {
                const err = new Error("aborted");
                err.name = "AbortError";
                throw err;
            }
            return { content: {}, statusCode: 200, cookies: {} };
        }, retry);
        await client.request("https://example.com");
        expect(attempts).to.equal(2);
    });

    it("retries on UND_ERR_SOCKET / ECONNRESET via cause.code", async function() {
        const retry = new RetryPolicy({
            maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, jitterMs: 0,
        });
        let attempts = 0;
        const client = clientWithFakeSession(APIClient, () => {
            attempts++;
            if (attempts < 2) {
                const err = new Error("connection reset");
                err.cause = { code: "ECONNRESET" };
                throw err;
            }
            return { content: {}, statusCode: 200, cookies: {} };
        }, retry);
        await client.request("https://example.com");
        expect(attempts).to.equal(2);
    });
});


describe("Cloudflare detection (policy)", function() {
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

    it("raises CloudflareError on 520", async function() {
        mockPool.intercept({ path: "/cf520" }).reply(520, "");
        try {
            await request("https://example.com/cf520", { dispatcher: mockAgent });
            expect.fail("should have thrown");
        }
        catch (err) {
            expect(err).to.be.instanceOf(CloudflareError);
        }
    });

    it("raises CloudflareError on 403 with cf-mitigated header", async function() {
        mockPool.intercept({ path: "/cf403" })
            .reply(403, "", { headers: { "cf-mitigated": "challenge" } });
        try {
            await request("https://example.com/cf403", { dispatcher: mockAgent });
            expect.fail("should have thrown");
        }
        catch (err) {
            expect(err).to.be.instanceOf(CloudflareError);
        }
    });

    it("does NOT raise CloudflareError on bare 403 (origin error)", async function() {
        // FR24 origin sometimes returns 403 for premium-only endpoints —
        // those must surface as a generic HTTP error, not CloudflareError.
        mockPool.intercept({ path: "/origin403" })
            .reply(403, "", { headers: { server: "cloudflare" } });
        try {
            await request("https://example.com/origin403", { dispatcher: mockAgent });
            expect.fail("should have thrown");
        }
        catch (err) {
            expect(err).to.not.be.instanceOf(CloudflareError);
            expect(err.message).to.include("403");
        }
    });

    it("allowedErrorCodes opts out of CF detection AND of raise_for_status", async function() {
        // getAirlineLogo / getCountryFlag pass [403, 404] to mean "asset not on CDN".
        mockPool.intercept({ path: "/asset404" })
            .reply(403, "", { headers: { "cf-mitigated": "challenge" } });
        const { statusCode } = await request("https://example.com/asset404", {
            dispatcher: mockAgent,
            allowedErrorCodes: [403, 404],
        });
        expect(statusCode).to.equal(403);
    });
});
