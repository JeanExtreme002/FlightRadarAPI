package flightradarapi

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"compress/zlib"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/andybalholm/brotli"
)

// MaxResponseBytes is the default budget for a response body, before and after
// decompression. A compressed body is trusted only as far as its expanded size:
// brotli reaches ratios high enough to exhaust memory from a few kilobytes on
// the wire.
const MaxResponseBytes = 64 * 1024 * 1024

// DefaultTimeout is the per-request timeout when none is given.
const DefaultTimeout = 30 * time.Second

var gzipMagic = []byte{0x1f, 0x8b}

// decoders maps a Content-Encoding token to its decompressor. Owning the
// decoding (the transport is told not to) is what makes the budget enforceable.
var decoders = map[string]func(data []byte, limit int) ([]byte, error){
	"gzip":    decompressGzip,
	"deflate": decompressDeflate,
	"br":      decompressBrotli,
}

// supportedEncodings is advertised on every request. Derived from the decoder
// table, so advertising an encoding with no decoder is not expressible.
const supportedEncodings = "gzip, deflate, br"

var logger atomic.Pointer[slog.Logger]

// SetLogger routes this package's warnings to l, process-wide; nil restores the
// default. Without it, slog.Default() is used, so an application that configures
// slog receives them without calling this at all.
//
// Package-scoped rather than per-client on purpose: every message here reports
// that FR24 changed a payload's shape, which is true for the whole process. The
// Python and Node.js ports use a module logger for the same reason.
func SetLogger(l *slog.Logger) { logger.Store(l) }

func log() *slog.Logger {
	if l := logger.Load(); l != nil {
		return l
	}
	return slog.Default()
}

// limitError reports a body that grew past its budget.
func limitError(format string, args ...any) error {
	return &DecompressionLimitError{Message: fmt.Sprintf(format, args...)}
}

// readBounded reads everything from reader, refusing a stream past limit.
func readBounded(reader io.Reader, limit int, what string) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(reader, int64(limit)+1))

	if err != nil {
		return nil, err
	}
	if len(body) > limit {
		return nil, limitError("%s expands past the %d byte decompression limit", what, limit)
	}
	return body, nil
}

// decompressGzip inflates gzip bytes, across members and tolerating trailing
// padding, the way libcurl does.
func decompressGzip(data []byte, limit int) ([]byte, error) {
	source := bytes.NewReader(data)
	reader, err := gzip.NewReader(source)

	if err != nil {
		return nil, err
	}
	defer reader.Close()

	var decoded bytes.Buffer

	for {
		reader.Multistream(false)

		// A short read must raise rather than return what arrived: the caller
		// cannot tell truncated JSON from a malformed feed.
		member, err := readBounded(reader, limit-decoded.Len(), "gzip body")

		if err != nil {
			// Reported against the budget, not against what was left of it:
			// the members already decoded are not the caller's business.
			if errors.Is(err, ErrDecompressionLimit) {
				return nil, limitError("gzip body expands past the %d byte decompression limit", limit)
			}
			return nil, err
		}
		decoded.Write(member)

		// Another member only when the tail looks like one; trailing padding
		// is not an error.
		tail := data[len(data)-source.Len():]

		if !bytes.HasPrefix(tail, gzipMagic) {
			return decoded.Bytes(), nil
		}
		if err := reader.Reset(source); err != nil {
			return nil, err
		}
	}
}

// decompressDeflate inflates a deflate body in either shape it arrives in: RFC
// 9110 says zlib-wrapped, plenty of servers send raw.
func decompressDeflate(data []byte, limit int) ([]byte, error) {
	source := bytes.NewReader(data)
	zlibReader, err := zlib.NewReader(source)

	if err == nil {
		defer zlibReader.Close()
		decoded, err := readBounded(zlibReader, limit, "deflate body")

		if err == nil {
			return decoded, nil
		}
		if errors.Is(err, ErrDecompressionLimit) {
			return nil, err
		}
	}

	source.Reset(data)
	rawReader := flate.NewReader(source)
	defer rawReader.Close()

	decoded, err := readBounded(rawReader, limit, "deflate body")

	if err != nil {
		return nil, err
	}

	// A body that is not deflate at all can still inflate to plausible bytes,
	// so anything left over means this was never a deflate stream. The zlib
	// path above tolerates the same trailing bytes, because its checksum
	// already vouched for the body.
	if source.Len() > 0 {
		return nil, errors.New("body is not a complete deflate stream")
	}
	return decoded, nil
}

// decompressBrotli decompresses brotli bytes, refusing a body past limit.
func decompressBrotli(data []byte, limit int) ([]byte, error) {
	return readBounded(brotli.NewReader(bytes.NewReader(data)), limit, "brotli body")
}

// RetryPolicy retries transient failures: a Cloudflare block, a timeout, or a
// network error. The zero value retries nothing.
type RetryPolicy struct {
	// MaxAttempts is the total number of attempts, including the first.
	MaxAttempts int
	// BaseDelay is the first backoff sleep.
	BaseDelay time.Duration
	// MaxDelay caps the exponential backoff. Zero means uncapped.
	MaxDelay time.Duration
	// Jitter is the random span added to each sleep.
	Jitter time.Duration
}

// NewRetryPolicy returns a policy with the usual exponential backoff:
// 1s base, 30s cap, 500ms jitter.
func NewRetryPolicy(maxAttempts int) (*RetryPolicy, error) {
	policy := &RetryPolicy{
		MaxAttempts: maxAttempts,
		BaseDelay:   time.Second,
		MaxDelay:    30 * time.Second,
		Jitter:      500 * time.Millisecond,
	}
	if err := policy.validate(); err != nil {
		return nil, err
	}
	return policy, nil
}

func (p *RetryPolicy) validate() error {
	if p.MaxAttempts < 1 {
		return fmt.Errorf("%w: MaxAttempts must be >= 1", ErrFlightRadar)
	}
	if p.BaseDelay < 0 || p.MaxDelay < 0 || p.Jitter < 0 {
		return fmt.Errorf("%w: BaseDelay, MaxDelay and Jitter must all be >= 0", ErrFlightRadar)
	}
	return nil
}

// SleepFor returns the backoff before the attempt after the given 0-based one.
//
// Every field is public, so this must hold for values [New] never saw: a zero
// MaxDelay caps nothing rather than capping everything at zero, and a negative
// Jitter adds nothing rather than panicking.
func (p *RetryPolicy) SleepFor(attemptIndex int) time.Duration {
	delay := float64(p.BaseDelay) * math.Pow(2, float64(attemptIndex))

	if capped := float64(p.MaxDelay); capped > 0 && delay > capped {
		delay = capped
	}
	if delay >= float64(math.MaxInt64) {
		return time.Duration(math.MaxInt64)
	}

	jitter := int64(0)

	if p.Jitter > 0 {
		span := int64(p.Jitter)

		// The endpoint is included by sampling one past the span, which only
		// the largest Duration there is cannot afford.
		if span < math.MaxInt64 {
			span++
		}
		jitter = rand.Int63n(span)
	}

	total := int64(delay) + jitter

	// Two values that each fit can still overflow together.
	if total < 0 {
		return time.Duration(math.MaxInt64)
	}
	return time.Duration(total)
}

// isTransient reports whether a failure is worth retrying.
func isTransient(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, ErrDecompressionLimit) {
		return false
	}
	if errors.Is(err, ErrCloudflare) || errors.Is(err, context.DeadlineExceeded) {
		return true
	}

	var urlErr *url.Error
	return errors.As(err, &urlErr)
}

// runWithRetry executes fn, retrying transient failures per the policy.
func runWithRetry[T any](ctx context.Context, policy *RetryPolicy, fn func() (T, error)) (T, error) {
	if policy == nil || policy.MaxAttempts <= 1 {
		return fn()
	}

	var zero T
	var lastErr error

	for attempt := range policy.MaxAttempts {
		result, err := fn()

		if err == nil {
			return result, nil
		}
		if !isTransient(err) {
			return zero, err
		}
		lastErr = err

		if attempt < policy.MaxAttempts-1 {
			select {
			case <-ctx.Done():
				return zero, ctx.Err()
			case <-time.After(policy.SleepFor(attempt)):
			}
		}
	}
	return zero, lastErr
}

// TLSProfile approximates a browser's TLS handshake. Go fixes its own cipher
// suite ordering, so this narrows the offered set and curve order rather than
// reproducing a JA3 exactly; see [Options.HTTPClient] for full impersonation.
type TLSProfile struct {
	CipherSuites     []uint16
	CurvePreferences []tls.CurveID
	MinVersion       uint16
	MaxVersion       uint16
}

// Chrome136Profile is the TLS profile used by default.
func Chrome136Profile() TLSProfile {
	return TLSProfile{
		CipherSuites: []uint16{
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA,
			tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
			tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_RSA_WITH_AES_128_CBC_SHA,
			tls.TLS_RSA_WITH_AES_256_CBC_SHA,
		},
		CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256, tls.CurveP384, tls.CurveP521},
		MinVersion:       tls.VersionTLS12,
		MaxVersion:       tls.VersionTLS13,
	}
}

// jarKey carries a request's cookie jar to the redirect handler.
type jarKey struct{}

// maxRedirects is the limit net/http applies by default, kept when this package
// takes the redirect handler over.
const maxRedirects = 10

// bankRedirectCookies keeps the jar in step across redirect hops. net/http
// follows them internally, so without this the hop that hands out a cookie is
// never seen, and a cross-host hop travels with no Cookie header at all.
func bankRedirectCookies(request *http.Request, via []*http.Request) error {
	if len(via) >= maxRedirects {
		return fmt.Errorf("%w: stopped after %d redirects", ErrFlightRadar, maxRedirects)
	}

	jar, _ := request.Context().Value(jarKey{}).(*cookieJar)

	if jar == nil {
		return nil
	}

	// Credited to the host that answered, not to the one being redirected to.
	if response := request.Response; response != nil && len(via) > 0 {
		jar.store(via[len(via)-1].URL, response.Header.Values("Set-Cookie"))
	}

	if header := jar.header(request.URL); header != "" {
		request.Header.Set("cookie", header)
	} else {
		request.Header.Del("cookie")
	}
	return nil
}

// newHTTPClient builds a client that impersonates the profile and leaves
// content decoding to this package.
func newHTTPClient(profile TLSProfile) *http.Client {
	// A comma-ok assertion, because http.DefaultTransport is an interface an
	// application (or a mocking library) is free to replace.
	transport := &http.Transport{Proxy: http.ProxyFromEnvironment}

	if standard, ok := http.DefaultTransport.(*http.Transport); ok {
		transport = standard.Clone()
	}

	// Decoding is ours: the transport would expand a bomb before any budget
	// could see it.
	transport.DisableCompression = true
	transport.ForceAttemptHTTP2 = true
	transport.TLSClientConfig = &tls.Config{
		CipherSuites:     profile.CipherSuites,
		CurvePreferences: profile.CurvePreferences,
		MinVersion:       profile.MinVersion,
		MaxVersion:       profile.MaxVersion,
	}
	return &http.Client{Transport: transport, CheckRedirect: bankRedirectCookies}
}

// requestOptions are the knobs of a single request.
type requestOptions struct {
	params            url.Values
	headers           map[string]string
	data              url.Values
	allowedErrorCodes []int
	timeout           time.Duration
	// maxResponseBytes rejects a body that expands past this many bytes.
	maxResponseBytes int
	// maxDownloadBytes rejects a body larger than this on the wire. Separate
	// because compression can grow incompressible data.
	maxDownloadBytes int
}

// Response is a decoded FlightRadar24 response.
type Response struct {
	URL        string
	StatusCode int
	Status     string
	Header     http.Header
	// Body is the body after Content-Encoding has been undone.
	Body []byte
	// Cookies are the name/value pairs the response set.
	Cookies map[string]string
}

// IsJSON reports whether the response announced a JSON body.
func (r *Response) IsJSON() bool {
	return strings.Contains(r.Header.Get("Content-Type"), "application/json")
}

// JSON parses the body as a JSON object.
func (r *Response) JSON() (map[string]any, error) {
	if !r.IsJSON() {
		return nil, fmt.Errorf("%w: expected JSON response from %s, got %q",
			ErrFlightRadar, r.URL, r.Header.Get("Content-Type"))
	}

	var content map[string]any

	if err := json.Unmarshal(bytes.TrimPrefix(r.Body, []byte("\xef\xbb\xbf")), &content); err != nil {
		return nil, fmt.Errorf("%w: could not parse the JSON body of %s: %w", ErrFlightRadar, r.URL, err)
	}
	return content, nil
}

// Text returns the body as a string, dropping a leading byte-order mark.
func (r *Response) Text() string {
	return string(bytes.TrimPrefix(r.Body, []byte("\xef\xbb\xbf")))
}

// apiClient owns the persistent session (cookie jar, TLS fingerprint) so the
// rest of the package never deals with those concerns.
type apiClient struct {
	httpClient *http.Client
	jar        *cookieJar
	retry      *RetryPolicy
}

func newAPIClient(httpClient *http.Client, retry *RetryPolicy) *apiClient {
	// Copied so a caller's client is left alone, and so a client that follows
	// redirects blindly still banks the cookies handed out on the way.
	client := *httpClient

	if client.CheckRedirect == nil {
		client.CheckRedirect = bankRedirectCookies
	}

	// This package renders the Cookie header itself. A jar on the caller's
	// client would append a second copy of every cookie to that same header.
	client.Jar = nil
	return &apiClient{httpClient: &client, jar: newCookieJar(), retry: retry}
}

// request makes a request through the shared session, sending the cookies in
// scope for the URL and banking the ones the response returns.
func (c *apiClient) request(ctx context.Context, target string, options requestOptions) (*Response, error) {
	return runWithRetry(ctx, c.retry, func() (*Response, error) {
		return c.do(ctx, target, options, c.jar)
	})
}

// requestStandalone makes a request that does not touch the shared cookie jar,
// so concurrent fan-outs cannot race Set-Cookie headers onto it.
func (c *apiClient) requestStandalone(ctx context.Context, target string, options requestOptions) (*Response, error) {
	return runWithRetry(ctx, c.retry, func() (*Response, error) {
		return c.do(ctx, target, options, nil)
	})
}

func (c *apiClient) getCookie(name string) (string, bool) { return c.jar.get(name) }
func (c *apiClient) clearCookies()                        { c.jar.clear() }
func (c *apiClient) deleteCookie(name string)             { c.jar.delete(name) }

func (c *apiClient) do(ctx context.Context, target string, options requestOptions, jar *cookieJar) (*Response, error) {
	maxResponseBytes := options.maxResponseBytes

	if maxResponseBytes == 0 {
		maxResponseBytes = MaxResponseBytes
	}
	if maxResponseBytes < 1 {
		return nil, fmt.Errorf("%w: maxResponseBytes must be >= 1", ErrFlightRadar)
	}

	maxDownloadBytes := options.maxDownloadBytes

	if maxDownloadBytes == 0 {
		maxDownloadBytes = maxResponseBytes
	}
	if maxDownloadBytes < 1 {
		return nil, fmt.Errorf("%w: maxDownloadBytes must be >= 1", ErrFlightRadar)
	}

	if len(options.params) > 0 {
		target += "?" + options.params.Encode()
	}

	parsed, err := url.Parse(target)

	if err != nil {
		return nil, fmt.Errorf("%w: invalid URL %q: %w", ErrFlightRadar, target, err)
	}

	if jar != nil {
		ctx = context.WithValue(ctx, jarKey{}, jar)
	}

	timeout := options.timeout

	// Zero or less means the default, as Options documents: a negative value
	// must not leave the request unbounded.
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	method := http.MethodGet
	var body io.Reader

	if options.data != nil {
		method = http.MethodPost
		body = strings.NewReader(options.data.Encode())
	}

	request, err := http.NewRequestWithContext(ctx, method, target, body)

	if err != nil {
		return nil, err
	}

	for name, value := range options.headers {
		request.Header.Set(name, value)
	}
	if request.Header.Get("accept-encoding") == "" {
		request.Header.Set("accept-encoding", supportedEncodings)
	}
	if method == http.MethodPost {
		request.Header.Set("content-type", "application/x-www-form-urlencoded")
	}
	if jar != nil {
		if header := jar.header(parsed); header != "" {
			request.Header.Set("cookie", header)
		}
	}

	response, err := c.httpClient.Do(request)

	if err != nil {
		// Wrapped twice: callers match the package sentinel, and the retry
		// policy still reads the transport's own cause underneath.
		return nil, fmt.Errorf("%w: %w", ErrFlightRadar, err)
	}
	defer response.Body.Close()

	received, err := io.ReadAll(io.LimitReader(response.Body, int64(maxDownloadBytes)+1))

	// Banked even on failure: the response that blocks a request is the one
	// that hands out the cookie needed to pass next time. Credited to the host
	// that answered, which after a redirect is not the host that was asked.
	finalURL := parsed

	if response.Request != nil && response.Request.URL != nil {
		finalURL = response.Request.URL
	}
	if jar != nil {
		jar.store(finalURL, response.Header.Values("Set-Cookie"))
	}

	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrFlightRadar, err)
	}
	if len(received) > maxDownloadBytes {
		return nil, limitError("response body from %s is larger than the %d byte download limit",
			finalURL, maxDownloadBytes)
	}

	content, err := decodeBody(received, response, finalURL.String(), maxResponseBytes)

	if err != nil {
		return nil, err
	}

	// The decoders enforce the budget as they expand, but an identity body
	// never reaches one.
	if len(content) > maxResponseBytes {
		return nil, limitError("response body from %s is %d bytes, past the %d byte limit",
			finalURL, len(content), maxResponseBytes)
	}

	result := &Response{
		URL:        finalURL.String(),
		StatusCode: response.StatusCode,
		Status:     response.Status,
		Header:     response.Header,
		Body:       content,
		Cookies:    responseCookies(response.Header.Values("Set-Cookie")),
	}

	if isAllowed(response.StatusCode, options.allowedErrorCodes) {
		return result, nil
	}

	// Cloudflare detection only when the caller did not opt in to this status
	// code: getAirlineLogo/getCountryFlag allow 403 to mean "asset not found".
	if isCloudflareBlock(response.StatusCode, response.Header) {
		response.Body = io.NopCloser(bytes.NewReader(content))

		return nil, &CloudflareError{
			Message: "blocked by Cloudflare. Perhaps you are making too many calls, " +
				"or the TLS impersonation needs to be updated",
			Response: response,
			Body:     content,
		}
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, &StatusError{
			StatusCode: response.StatusCode,
			Status:     response.Status,
			URL:        finalURL.String(),
			Body:       content,
		}
	}
	return result, nil
}

func isAllowed(statusCode int, allowed []int) bool {
	for _, code := range allowed {
		if code == statusCode {
			return true
		}
	}
	return false
}

// isCloudflareBlock detects Cloudflare-level blocks.
//
// FR24 fronts the public site with Cloudflare, so a "Server: cloudflare" header
// is present on every response, including legitimate 403s from the FR24 origin
// (e.g. premium-only endpoints on a free account). Only signals Cloudflare sets
// when its own bot management acted are trusted: HTTP 520, and a 403 carrying
// cf-mitigated.
func isCloudflareBlock(statusCode int, headers http.Header) bool {
	if statusCode == 520 {
		return true
	}
	if statusCode != 403 {
		return false
	}
	return headers.Get("cf-mitigated") != ""
}

// responseCookies renders the Set-Cookie headers as name/value pairs.
func responseCookies(headers []string) map[string]string {
	cookies := make(map[string]string, len(headers))

	for _, header := range headers {
		pair := strings.Split(header, ";")[0]
		separator := strings.Index(pair, "=")

		// Split on the first "=" only, so base64 padding survives.
		if separator > 0 {
			cookies[strings.TrimSpace(pair[:separator])] = strings.TrimSpace(pair[separator+1:])
		}
	}
	return cookies
}

// decodeBody undoes the Content-Encoding a response arrived with. The header
// may stack encodings ("gzip, br" means gzip then brotli), so they are undone in
// reverse. A body that will not decode is returned as received, which is what a
// transport that decoded it after all leaves behind.
func decodeBody(content []byte, response *http.Response, target string, limit int) ([]byte, error) {
	var applied []string

	for _, token := range strings.Split(response.Header.Get("Content-Encoding"), ",") {
		token = strings.ToLower(strings.TrimSpace(token))

		if token != "" && token != "identity" {
			applied = append(applied, token)
		}
	}
	if len(applied) == 0 {
		return content, nil
	}

	chain := make([]func([]byte, int) ([]byte, error), 0, len(applied))

	for _, token := range applied {
		decode, ok := decoders[token]

		if !ok {
			log().Warn("no decoder for Content-Encoding; returning the body as received",
				"encoding", token, "url", target)
			return content, nil
		}
		chain = append(chain, decode)
	}

	decoded := content

	// Undone in reverse: "gzip, br" means gzip was applied first, brotli last.
	for index := len(chain) - 1; index >= 0; index-- {
		failedAt := applied[index]
		next, err := chain[index](decoded, limit)

		if err != nil {
			if errors.Is(err, ErrDecompressionLimit) {
				return nil, err
			}

			// Back to the bytes as received: a chain that failed halfway leaves
			// a half-decoded intermediate.
			logDecodeFailure(content, response, target, failedAt, err)
			return content, nil
		}
		decoded = next
	}
	return decoded, nil
}

// logDecodeFailure warns unless the body looks like the transport decoded it
// already, in which case there is nothing for a caller to act on.
func logDecodeFailure(content []byte, response *http.Response, target, failedAt string, cause error) {
	contentType := response.Header.Get("Content-Type")
	transportDecoded := false

	switch {
	case strings.HasPrefix(contentType, "application/json"), strings.HasPrefix(contentType, "text/"):
		// Undecodable text is genuinely broken; a body that reads as UTF-8 was
		// most likely decoded by the transport already.
		transportDecoded = utf8.Valid(content)
	default:
		// A body still carrying the gzip magic was not decoded by anyone, so
		// the decoder failing on it is a real corruption, not a double decode.
		transportDecoded = !(failedAt == "gzip" && bytes.HasPrefix(content, gzipMagic))
	}

	level := slog.LevelWarn

	if transportDecoded {
		level = slog.LevelDebug
	}
	log().Log(context.Background(), level,
		"failed to decode Content-Encoding; assuming the body arrived already decoded",
		"encoding", failedAt, "url", target, "error", cause)
}
