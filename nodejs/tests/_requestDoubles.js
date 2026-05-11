/**
 * Test doubles for the request layer (Node SDK).
 *
 * Shared between testRequestPolicy.js and testRequestTransport.js. The two
 * suites are split deliberately:
 *
 * - testRequestPolicy: product rules that survive a transport rewrite —
 *   retry semantics, Cloudflare detection rules, error taxonomy.
 * - testRequestTransport: adapter-shaped behavior that will need to be
 *   rewritten when undici is replaced (e.g. by node:fetch or a future
 *   Cloudflare-bypass library).
 *
 * When the HTTP library changes, expect to throw away testRequestTransport
 * and rewrite this file; testRequestPolicy should keep passing unchanged.
 */

/** Session double whose `.request` returns whatever `thunk(callCount)` returns. */
class FakeSession {
    /** @param {Function} thunk - called with the 1-based call count */
    constructor(thunk) {
        this.thunk = thunk;
        this.calls = 0;
    }

    /**
     * @param {string} _url
     * @param {object} _options
     * @return {Promise<*>}
     */
    async request(_url, _options) {
        this.calls++;
        return this.thunk(this.calls);
    }
}

/**
 * Build an APIClient whose internal session is a `FakeSession(thunk)`.
 * Drives `runWithRetry` from the public surface without monkey-patching
 * the module.
 *
 * @param {Function} APIClient - the APIClient class
 * @param {Function} thunk - called by FakeSession.request, return value resolves the promise
 * @param {object} [retry] - optional RetryPolicy instance
 * @return {object} APIClient instance with FakeSession swapped in
 */
function clientWithFakeSession(APIClient, thunk, retry) {
    const client = new APIClient({ retry });
    client.__session = new FakeSession(thunk);
    return client;
}

module.exports = { FakeSession, clientWithFakeSession };
