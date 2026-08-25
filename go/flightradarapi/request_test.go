package flightradarapi

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"compress/zlib"
	"context"
	"errors"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andybalholm/brotli"
)

// The request suite is split the way the Python and Node.js ones are: the
// policy tests cover rules that survive a transport rewrite (retry semantics,
// Cloudflare detection, the error taxonomy), the transport tests cover
// adapter-shaped behavior (method dispatch, query encoding, content decoding).

func testClient() *apiClient {
	return newAPIClient(newHTTPClient(Chrome136Profile()), nil)
}

// serve starts a test server and returns a client pointed at nothing in
// particular: the URL is handed to each call.
func serve(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return server
}

func gzipBytes(t *testing.T, data []byte) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := gzip.NewWriter(&buffer)

	if _, err := writer.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func zlibBytes(t *testing.T, data []byte) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := zlib.NewWriter(&buffer)

	if _, err := writer.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func rawDeflateBytes(t *testing.T, data []byte) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer, err := flate.NewWriter(&buffer, flate.DefaultCompression)

	if err != nil {
		t.Fatal(err)
	}
	if _, err := writer.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func brotliBytes(t *testing.T, data []byte) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := brotli.NewWriter(&buffer)

	if _, err := writer.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

// --- transport ---

func TestRequestSendsGETWithoutData(t *testing.T) {
	var method string
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		method = r.Method
		w.Write([]byte("ok"))
	})

	if _, err := testClient().request(context.Background(), server.URL, requestOptions{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if method != http.MethodGet {
		t.Errorf("got %s, want GET", method)
	}
}

func TestRequestSendsPOSTWithFormData(t *testing.T) {
	var method, body, contentType string
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received, _ := io.ReadAll(r.Body)
		method, body, contentType = r.Method, string(received), r.Header.Get("Content-Type")
		w.Write([]byte("ok"))
	})

	data := url.Values{}
	data.Set("email", "user@example.com")
	data.Set("password", "secret")

	if _, err := testClient().request(context.Background(), server.URL, requestOptions{data: data}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if method != http.MethodPost {
		t.Errorf("got %s, want POST", method)
	}
	if !strings.Contains(body, "email=user%40example.com") || !strings.Contains(body, "password=secret") {
		t.Errorf("got body %q", body)
	}
	if contentType != "application/x-www-form-urlencoded" {
		t.Errorf("got content type %q", contentType)
	}
}

func TestRequestEncodesParamsIntoTheQuery(t *testing.T) {
	var query string
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.RawQuery
		w.Write([]byte("ok"))
	})

	params := url.Values{}
	params.Set("bounds", "75.78,-75.78,-427.56,427.56")
	params.Set("limit", "5000")

	if _, err := testClient().request(context.Background(), server.URL, requestOptions{params: params}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	parsed, err := url.ParseQuery(query)

	if err != nil {
		t.Fatal(err)
	}
	if parsed.Get("bounds") != "75.78,-75.78,-427.56,427.56" || parsed.Get("limit") != "5000" {
		t.Errorf("got query %q", query)
	}
}

func TestRequestAsksOnlyForEncodingsItCanDecode(t *testing.T) {
	var accept string
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		accept = r.Header.Get("Accept-Encoding")
		w.Write([]byte("ok"))
	})

	if _, err := testClient().request(context.Background(), server.URL, requestOptions{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if accept != supportedEncodings {
		t.Errorf("got %q, want %q", accept, supportedEncodings)
	}

	// zstd would arrive as bytes nothing here can read.
	if strings.Contains(accept, "zstd") {
		t.Error("zstd must not be advertised")
	}
}

func TestRequestKeepsAnExplicitAcceptEncoding(t *testing.T) {
	var accept string
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		accept = r.Header.Get("Accept-Encoding")
		w.Write([]byte("ok"))
	})

	_, err := testClient().request(context.Background(), server.URL, requestOptions{
		headers: map[string]string{"accept-encoding": "gzip"},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if accept != "gzip" {
		t.Errorf("got %q, want gzip", accept)
	}
}

func TestRequestSendsTheGivenHeaders(t *testing.T) {
	var agent, accept string
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		agent, accept = r.Header.Get("User-Agent"), r.Header.Get("Accept")
		w.Write([]byte("ok"))
	})

	_, err := testClient().request(context.Background(), server.URL, requestOptions{headers: jsonHeaders})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(agent, "Chrome/136") || accept != "application/json" {
		t.Errorf("got user agent %q accept %q", agent, accept)
	}
}

func TestRequestDecodesEveryAdvertisedEncoding(t *testing.T) {
	payload := []byte(`{"full_count": 12345}`)

	cases := []struct {
		encoding string
		body     func(*testing.T, []byte) []byte
	}{
		{"gzip", gzipBytes},
		{"deflate", zlibBytes},
		{"deflate", rawDeflateBytes},
		{"br", brotliBytes},
	}

	for _, testCase := range cases {
		t.Run(testCase.encoding, func(t *testing.T) {
			server := serve(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Encoding", testCase.encoding)
				w.Header().Set("Content-Type", "application/json")
				w.Write(testCase.body(t, payload))
			})

			response, err := testClient().request(context.Background(), server.URL, requestOptions{})

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !bytes.Equal(response.Body, payload) {
				t.Errorf("got %q, want %q", response.Body, payload)
			}
		})
	}
}

func TestRequestDecodesStackedEncodings(t *testing.T) {
	payload := []byte("stacked body")
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip, br")
		w.Write(brotliBytes(t, gzipBytes(t, payload)))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !bytes.Equal(response.Body, payload) {
		t.Errorf("got %q, want %q", response.Body, payload)
	}
}

func TestRequestDecodesEncodingTokensCaseInsensitively(t *testing.T) {
	payload := []byte("upper case token")
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", " GZIP ")
		w.Write(gzipBytes(t, payload))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !bytes.Equal(response.Body, payload) {
		t.Errorf("got %q, want %q", response.Body, payload)
	}
}

func TestRequestDecodesAMultiMemberGzipBody(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Write(append(gzipBytes(t, []byte("first ")), gzipBytes(t, []byte("second"))...))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(response.Body) != "first second" {
		t.Errorf("got %q, want \"first second\"", response.Body)
	}
}

func TestRequestToleratesTrailingPaddingAfterAGzipBody(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Write(append(gzipBytes(t, []byte("padded")), 0, 0, 0))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(response.Body) != "padded" {
		t.Errorf("got %q, want \"padded\"", response.Body)
	}
}

func TestRequestReturnsTheBodyWhenTheTransportAlreadyDecodedIt(t *testing.T) {
	// The header claims an encoding the body does not carry, which is what a
	// transport that decoded it leaves behind.
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"already": "decoded"}`))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(response.Body) != `{"already": "decoded"}` {
		t.Errorf("got %q", response.Body)
	}
}

func TestRequestReturnsTheBodyForAnEncodingWithNoDecoder(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "zstd")
		w.Write([]byte("opaque"))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(response.Body) != "opaque" {
		t.Errorf("got %q, want the body as received", response.Body)
	}
}

func TestRequestRefusesABodyThatExpandsPastTheBudget(t *testing.T) {
	bomb := gzipBytes(t, bytes.Repeat([]byte("A"), 1<<20))
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Write(bomb)
	})

	_, err := testClient().request(context.Background(), server.URL, requestOptions{
		maxResponseBytes: 1024,
	})

	if !errors.Is(err, ErrDecompressionLimit) {
		t.Errorf("got %v, want a decompression limit error", err)
	}
}

func TestRequestRefusesABodyLargerThanTheDownloadBudget(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(bytes.Repeat([]byte("A"), 4096))
	})

	_, err := testClient().request(context.Background(), server.URL, requestOptions{
		maxDownloadBytes: 1024,
		maxResponseBytes: 1 << 20,
	})

	if !errors.Is(err, ErrDecompressionLimit) {
		t.Errorf("got %v, want a decompression limit error", err)
	}
}

func TestRequestRefusesAnIdentityBodyPastTheBudget(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(bytes.Repeat([]byte("A"), 4096))
	})

	_, err := testClient().request(context.Background(), server.URL, requestOptions{maxResponseBytes: 1024})

	if !errors.Is(err, ErrDecompressionLimit) {
		t.Errorf("got %v, want a decompression limit error", err)
	}
}

func TestRequestAcceptsABodyExactlyAtTheBudget(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(bytes.Repeat([]byte("A"), 1024))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{
		maxResponseBytes: 1024,
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(response.Body) != 1024 {
		t.Errorf("got %d bytes, want 1024", len(response.Body))
	}
}

func TestResponseJSONNeedsAJSONContentType(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`{"a": 1}`))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := response.JSON(); err == nil {
		t.Error("expected an error for a non-JSON content type")
	}
}

func TestResponseJSONParsesAJSONBody(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Write([]byte(`{"full_count": 12345}`))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	content, err := response.JSON()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count, _ := content["full_count"].(float64); count != 12345 {
		t.Errorf("got %v, want 12345", content["full_count"])
	}
}

func TestResponseTextDropsAByteOrderMark(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(append([]byte("\xef\xbb\xbf"), []byte("body")...))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if response.Text() != "body" {
		t.Errorf("got %q, want body", response.Text())
	}
}

func TestRequestBanksAndReplaysCookies(t *testing.T) {
	var received string
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received = r.Header.Get("Cookie")
		w.Header().Add("Set-Cookie", "_frPl=token; Path=/")
		w.Write([]byte("ok"))
	})

	client := testClient()

	if _, err := client.request(context.Background(), server.URL, requestOptions{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value, ok := client.getCookie("_frPl"); !ok || value != "token" {
		t.Errorf("got cookie %q, want token", value)
	}
	if _, err := client.request(context.Background(), server.URL, requestOptions{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if received != "_frPl=token" {
		t.Errorf("got %q, want the cookie replayed", received)
	}
}

func TestRequestBanksCookiesFromABlockedResponse(t *testing.T) {
	// A Cloudflare 403 is exactly the response that hands out cf_clearance.
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("cf-mitigated", "challenge")
		w.Header().Add("Set-Cookie", "cf_clearance=pass; Path=/")
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("<html>challenge</html>"))
	})

	client := testClient()
	_, err := client.request(context.Background(), server.URL, requestOptions{})

	if !errors.Is(err, ErrCloudflare) {
		t.Fatalf("got %v, want a Cloudflare error", err)
	}
	if value, ok := client.getCookie("cf_clearance"); !ok || value != "pass" {
		t.Errorf("got cookie %q, want the challenge cookie banked", value)
	}
}

func TestRequestStandaloneLeavesTheJarAlone(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Cookie") != "" {
			t.Errorf("standalone request sent %q", r.Header.Get("Cookie"))
		}
		w.Header().Add("Set-Cookie", "session=1; Path=/")
		w.Write([]byte("ok"))
	})

	client := testClient()
	client.jar.store(mustURL(t, server.URL), []string{"existing=1; Path=/"})

	if _, err := client.requestStandalone(context.Background(), server.URL, requestOptions{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := client.getCookie("session"); ok {
		t.Error("a standalone request must not bank cookies")
	}
}

func TestRequestExposesTheResponseCookies(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Set-Cookie", "token=YWJjZA==; Path=/")
		w.Write([]byte("ok"))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if response.Cookies["token"] != "YWJjZA==" {
		t.Errorf("got %q, want the padding kept", response.Cookies["token"])
	}
}

// --- policy ---

func TestCloudflareBlockIsDetectedOnlyOnItsOwnSignals(t *testing.T) {
	cases := []struct {
		name       string
		statusCode int
		headers    map[string]string
		cloudflare bool
	}{
		{"520 from cloudflare", 520, nil, true},
		{"403 with cf-mitigated", 403, map[string]string{"cf-mitigated": "challenge"}, true},
		// A premium-only endpoint on a free account answers like this.
		{"403 from the origin", 403, map[string]string{"server": "cloudflare"}, false},
		{"500 from the origin", 500, nil, false},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			server := serve(t, func(w http.ResponseWriter, r *http.Request) {
				for name, value := range testCase.headers {
					w.Header().Set(name, value)
				}
				w.WriteHeader(testCase.statusCode)
			})

			_, err := testClient().request(context.Background(), server.URL, requestOptions{})

			if err == nil {
				t.Fatal("expected an error")
			}
			if errors.Is(err, ErrCloudflare) != testCase.cloudflare {
				t.Errorf("got %v, want cloudflare=%v", err, testCase.cloudflare)
			}
		})
	}
}

func TestCloudflareErrorCarriesTheChallengePage(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("cf-mitigated", "challenge")
		w.Header().Set("Content-Encoding", "gzip")
		w.WriteHeader(http.StatusForbidden)
		w.Write(gzipBytes(t, []byte("<html>Attention Required</html>")))
	})

	_, err := testClient().request(context.Background(), server.URL, requestOptions{})

	var cloudflareErr *CloudflareError

	if !errors.As(err, &cloudflareErr) {
		t.Fatalf("got %v, want a CloudflareError", err)
	}
	if !strings.Contains(string(cloudflareErr.Body), "Attention Required") {
		t.Errorf("got body %q, want the decoded challenge page", cloudflareErr.Body)
	}
	if cloudflareErr.Response == nil || cloudflareErr.Response.StatusCode != http.StatusForbidden {
		t.Error("the blocked response must be carried on the error")
	}
}

func TestAllowedErrorCodesSuppressBothChecks(t *testing.T) {
	// GetAirlineLogo and GetCountryFlag allow 403 to mean "asset not found".
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("cf-mitigated", "challenge")
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("no asset"))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{
		allowedErrorCodes: []int{403, 404},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if response.StatusCode != http.StatusForbidden {
		t.Errorf("got %d, want 403", response.StatusCode)
	}
}

func TestStatusErrorCarriesTheStatusAndURL(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	_, err := testClient().request(context.Background(), server.URL, requestOptions{})

	var statusErr *StatusError

	if !errors.As(err, &statusErr) {
		t.Fatalf("got %v, want a StatusError", err)
	}
	if statusErr.StatusCode != 500 || !strings.HasPrefix(statusErr.URL, server.URL) {
		t.Errorf("got %d for %q", statusErr.StatusCode, statusErr.URL)
	}
	if !errors.Is(err, ErrFlightRadar) {
		t.Error("every error must match ErrFlightRadar")
	}
}

func TestRetryRecoversFromATransientBlock(t *testing.T) {
	var attempts atomic.Int32
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if attempts.Add(1) < 3 {
			w.Header().Set("cf-mitigated", "challenge")
			w.WriteHeader(http.StatusForbidden)
			return
		}
		w.Write([]byte("ok"))
	})

	client := newAPIClient(newHTTPClient(Chrome136Profile()), &RetryPolicy{
		MaxAttempts: 3, BaseDelay: time.Millisecond,
	})

	response, err := client.request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(response.Body) != "ok" {
		t.Errorf("got %q, want ok", response.Body)
	}
	if attempts.Load() != 3 {
		t.Errorf("got %d attempts, want 3", attempts.Load())
	}
}

func TestRetryGivesUpAfterMaxAttempts(t *testing.T) {
	var attempts atomic.Int32
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		w.WriteHeader(520)
	})

	client := newAPIClient(newHTTPClient(Chrome136Profile()), &RetryPolicy{
		MaxAttempts: 2, BaseDelay: time.Millisecond,
	})

	if _, err := client.request(context.Background(), server.URL, requestOptions{}); !errors.Is(err, ErrCloudflare) {
		t.Errorf("got %v, want the last Cloudflare error", err)
	}
	if attempts.Load() != 2 {
		t.Errorf("got %d attempts, want 2", attempts.Load())
	}
}

func TestRetryLeavesANonTransientErrorAlone(t *testing.T) {
	var attempts atomic.Int32
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	})

	client := newAPIClient(newHTTPClient(Chrome136Profile()), &RetryPolicy{
		MaxAttempts: 3, BaseDelay: time.Millisecond,
	})

	if _, err := client.request(context.Background(), server.URL, requestOptions{}); err == nil {
		t.Fatal("expected an error")
	}
	if attempts.Load() != 1 {
		t.Errorf("got %d attempts, want 1: a 500 is the origin's answer, not a transient failure",
			attempts.Load())
	}
}

func TestRetryPolicyBackoffGrowsAndIsCapped(t *testing.T) {
	policy := &RetryPolicy{MaxAttempts: 5, BaseDelay: time.Second, MaxDelay: 4 * time.Second}

	for attempt, expected := range map[int]time.Duration{0: time.Second, 1: 2 * time.Second, 5: 4 * time.Second} {
		if got := policy.SleepFor(attempt); got != expected {
			t.Errorf("attempt %d: got %v, want %v", attempt, got, expected)
		}
	}
}

func TestRetryPolicyJitterStaysInRange(t *testing.T) {
	policy := &RetryPolicy{MaxAttempts: 2, BaseDelay: time.Second, MaxDelay: time.Second, Jitter: time.Second}

	for range 20 {
		delay := policy.SleepFor(0)

		if delay < time.Second || delay > 2*time.Second {
			t.Fatalf("got %v, want between 1s and 2s", delay)
		}
	}
}

func TestNewRetryPolicyRejectsAnImpossibleAttemptCount(t *testing.T) {
	if _, err := NewRetryPolicy(0); err == nil {
		t.Error("expected an error for MaxAttempts below 1")
	}
}

func TestRequestHonoursACancelledContext(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := testClient().request(ctx, server.URL, requestOptions{}); !errors.Is(err, context.Canceled) {
		t.Errorf("got %v, want a cancelled context", err)
	}
}

func TestRequestTimesOut(t *testing.T) {
	release := make(chan struct{})
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		<-release
	})
	t.Cleanup(func() { close(release) })

	_, err := testClient().request(context.Background(), server.URL, requestOptions{
		timeout: 50 * time.Millisecond,
	})

	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("got %v, want a deadline error", err)
	}
}

func TestIsTransientClassifiesFailures(t *testing.T) {
	cases := []struct {
		name      string
		err       error
		transient bool
	}{
		{"cloudflare", &CloudflareError{Message: "blocked"}, true},
		{"timeout", &url.Error{Op: "Get", Err: context.DeadlineExceeded}, true},
		{"network", &url.Error{Op: "Get", Err: errors.New("connection reset")}, true},
		{"cancelled", context.Canceled, false},
		{"decompression limit", &DecompressionLimitError{Message: "too big"}, false},
		{"status", &StatusError{StatusCode: 500}, false},
		{"nothing", nil, false},
	}

	for _, testCase := range cases {
		if got := isTransient(testCase.err); got != testCase.transient {
			t.Errorf("%s: got %v, want %v", testCase.name, got, testCase.transient)
		}
	}
}

func TestDecompressorsRejectATruncatedBody(t *testing.T) {
	payload := bytes.Repeat([]byte("A"), 4096)

	cases := map[string][]byte{
		"gzip":    gzipBytes(t, payload),
		"deflate": zlibBytes(t, payload),
		"br":      brotliBytes(t, payload),
	}

	for encoding, body := range cases {
		t.Run(encoding, func(t *testing.T) {
			if _, err := decoders[encoding](body[:len(body)/2], MaxResponseBytes); err == nil {
				t.Error("a truncated body must not pass as whole")
			}
		})
	}
}

func TestRequestBanksCookiesHandedOutOnARedirectHop(t *testing.T) {
	// net/http follows redirects internally, so the hop that sets the cookie is
	// never seen by the caller.
	var finalCookie string
	mux := http.NewServeMux()
	mux.HandleFunc("/start", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Set-Cookie", "hop=abc; Path=/")
		http.Redirect(w, r, "/final", http.StatusFound)
	})
	mux.HandleFunc("/final", func(w http.ResponseWriter, r *http.Request) {
		finalCookie = r.Header.Get("Cookie")
		w.Write([]byte("ok"))
	})

	client := testClient()
	_, err := client.request(context.Background(), serve(t, mux.ServeHTTP).URL+"/start", requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value, ok := client.getCookie("hop"); !ok || value != "abc" {
		t.Errorf("got cookie %q, want the redirect hop's cookie banked", value)
	}
	if finalCookie != "hop=abc" {
		t.Errorf("got %q on the final hop, want the cookie replayed", finalCookie)
	}
}

func TestRequestSendsInScopeCookiesAfterACrossHostRedirect(t *testing.T) {
	// Go strips the Cookie header on a cross-host redirect; a domain-scoped
	// cookie still belongs on the new host.
	var received string
	target := serve(t, func(w http.ResponseWriter, r *http.Request) {
		received = r.Header.Get("Cookie")
		w.Write([]byte("ok"))
	})
	origin := serve(t, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL+"/final", http.StatusFound)
	})

	client := testClient()
	client.jar.store(mustURL(t, target.URL), []string{"session=1; Path=/"})

	if _, err := client.request(context.Background(), origin.URL, requestOptions{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if received != "session=1" {
		t.Errorf("got %q, want the cookie of the host being redirected to", received)
	}
}

func TestRequestStopsAfterTooManyRedirects(t *testing.T) {
	var server *httptest.Server
	server = serve(t, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, server.URL+"/again", http.StatusFound)
	})

	if _, err := testClient().request(context.Background(), server.URL, requestOptions{}); err == nil {
		t.Error("expected an error for a redirect loop")
	}
}

func TestRequestStandaloneStillFollowsRedirects(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/start", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Set-Cookie", "hop=abc; Path=/")
		http.Redirect(w, r, "/final", http.StatusFound)
	})
	mux.HandleFunc("/final", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	client := testClient()
	response, err := client.requestStandalone(
		context.Background(), serve(t, mux.ServeHTTP).URL+"/start", requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(response.Body) != "ok" {
		t.Errorf("got %q, want the body of the final hop", response.Body)
	}
	if _, ok := client.getCookie("hop"); ok {
		t.Error("a standalone request must not bank a redirect hop's cookies either")
	}
}

func TestGivenHTTPClientIsLeftUnmodified(t *testing.T) {
	given := &http.Client{Transport: newHTTPClient(Chrome136Profile()).Transport}
	newAPIClient(given, nil)

	if given.CheckRedirect != nil {
		t.Error("the caller's client must not be modified")
	}
}

func TestGivenRedirectHandlerIsKept(t *testing.T) {
	var called bool
	given := &http.Client{
		Transport: newHTTPClient(Chrome136Profile()).Transport,
		CheckRedirect: func(request *http.Request, via []*http.Request) error {
			called = true
			return http.ErrUseLastResponse
		},
	}

	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/final", http.StatusFound)
	})

	response, err := newAPIClient(given, nil).request(context.Background(), server.URL, requestOptions{
		allowedErrorCodes: []int{302},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called || response.StatusCode != http.StatusFound {
		t.Errorf("called=%v status=%d, want the caller's handler to decide", called, response.StatusCode)
	}
}

// --- decoder budget and integrity, mirroring the Python transport suite ---

func TestEveryDecoderRefusesABomb(t *testing.T) {
	payload := bytes.Repeat([]byte("A"), 1<<20)

	cases := map[string][]byte{
		"gzip":    gzipBytes(t, payload),
		"deflate": zlibBytes(t, payload),
		"br":      brotliBytes(t, payload),
	}

	for encoding, body := range cases {
		t.Run(encoding, func(t *testing.T) {
			server := serve(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Encoding", encoding)
				w.Write(body)
			})

			_, err := testClient().request(context.Background(), server.URL, requestOptions{
				maxResponseBytes: 1024,
			})

			if !errors.Is(err, ErrDecompressionLimit) {
				t.Errorf("got %v, want a decompression limit error", err)
			}
		})
	}
}

func TestEveryAdvertisedEncodingHasADecoder(t *testing.T) {
	// The header is derived from the table, so this catches the const drifting.
	for _, token := range strings.Split(supportedEncodings, ",") {
		token = strings.TrimSpace(token)

		if _, ok := decoders[token]; !ok {
			t.Errorf("%q is advertised with no decoder behind it", token)
		}
	}

	for token := range decoders {
		if !strings.Contains(supportedEncodings, token) {
			t.Errorf("%q has a decoder that is never advertised", token)
		}
	}
}

func TestAnEmptyBodyIsNotMistakenForABomb(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Write(gzipBytes(t, nil))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{
		maxResponseBytes: 1024,
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(response.Body) != 0 {
		t.Errorf("got %q, want an empty body", response.Body)
	}
}

func TestANonsensicalBudgetIsRejectedAtTheCall(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	cases := map[string]requestOptions{
		"negative response budget": {maxResponseBytes: -1},
		"negative download budget": {maxDownloadBytes: -1},
	}

	for name, options := range cases {
		if _, err := testClient().request(context.Background(), server.URL, options); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestTheDownloadBudgetDefaultsToTheExpansionBudget(t *testing.T) {
	// 4096 uncompressed bytes on the wire, and no separate download bound.
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(bytes.Repeat([]byte("A"), 4096))
	})

	_, err := testClient().request(context.Background(), server.URL, requestOptions{
		maxResponseBytes: 1024,
	})

	if !errors.Is(err, ErrDecompressionLimit) {
		t.Errorf("got %v, want the response budget to bound the download too", err)
	}
}

func TestTheDownloadBudgetCanBeLooserThanTheExpansionBudget(t *testing.T) {
	// Compression can grow incompressible data, so a body that expands to just
	// under the budget may still arrive slightly over it.
	payload := bytes.Repeat([]byte("A"), 2048)
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Write(gzipBytes(t, payload))
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{
		maxResponseBytes: 4096,
		maxDownloadBytes: 1 << 20,
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(response.Body) != len(payload) {
		t.Errorf("got %d bytes, want %d", len(response.Body), len(payload))
	}
}

func TestABodyThatIsNotDeflateRaisesRatherThanInflatingToGarbage(t *testing.T) {
	// Raw deflate carries no header and no checksum, so a body that is not
	// deflate at all can still inflate to plausible bytes.
	if _, err := decompressDeflate([]byte("this is not a deflate stream at all"), MaxResponseBytes); err == nil {
		t.Error("expected an error rather than garbage")
	}
}

func TestTrailingBytesDoNotBreakAZlibWrappedBody(t *testing.T) {
	payload := []byte("a zlib body with padding after it")
	body := append(zlibBytes(t, payload), 0, 0, 0)

	decoded, err := decompressDeflate(body, MaxResponseBytes)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !bytes.Equal(decoded, payload) {
		t.Errorf("got %q, want %q", decoded, payload)
	}
}

func TestAChainThatFailsMidwayFallsBackToTheBodyAsReceived(t *testing.T) {
	// The outer brotli layer decodes; the inner gzip layer never does.
	inner := []byte("not gzip at all")
	received := brotliBytes(t, inner)

	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip, br")
		w.Write(received)
	})

	response, err := testClient().request(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !bytes.Equal(response.Body, received) {
		t.Errorf("got %q, want the body exactly as received, not the half-decoded intermediate",
			response.Body)
	}
}

func TestAnUndecodableEncodingWarns(t *testing.T) {
	var logged bytes.Buffer
	SetLogger(slog.New(slog.NewTextHandler(&logged, &slog.HandlerOptions{Level: slog.LevelDebug})))
	t.Cleanup(func() { SetLogger(nil) })

	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "zstd")
		w.Write([]byte("opaque"))
	})

	if _, err := testClient().request(context.Background(), server.URL, requestOptions{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	output := logged.String()

	if !strings.Contains(output, "level=WARN") || !strings.Contains(output, "zstd") {
		t.Errorf("got %q, want a warning naming the encoding", output)
	}
}

func TestTheStandalonePathDecodesAndBoundsToo(t *testing.T) {
	payload := []byte(`{"decoded": true}`)
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "br")
		w.Header().Set("Content-Type", "application/json")
		w.Write(brotliBytes(t, payload))
	})

	client := testClient()
	response, err := client.requestStandalone(context.Background(), server.URL, requestOptions{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !bytes.Equal(response.Body, payload) {
		t.Errorf("got %q, want %q", response.Body, payload)
	}

	_, err = client.requestStandalone(context.Background(), server.URL, requestOptions{
		maxResponseBytes: 4,
	})

	if !errors.Is(err, ErrDecompressionLimit) {
		t.Errorf("got %v, want the standalone path to enforce the budget too", err)
	}
}

func TestTheTransportNeverDecodesForUs(t *testing.T) {
	// Owning the decoding is what makes the budget enforceable.
	transport, ok := newHTTPClient(Chrome136Profile()).Transport.(*http.Transport)

	if !ok {
		t.Fatal("expected an *http.Transport")
	}
	if !transport.DisableCompression {
		t.Error("the transport must leave content decoding to this package")
	}
}

// --- retry policy edges ---

func TestRetryPolicyValidationReportsNegativeTiming(t *testing.T) {
	// The Python and Node.js ports raise from the RetryPolicy constructor, which
	// is where this port reports it too.
	cases := map[string]*RetryPolicy{
		"negative base delay": {MaxAttempts: 2, BaseDelay: -time.Second},
		"negative max delay":  {MaxAttempts: 2, MaxDelay: -time.Second},
		"negative jitter":     {MaxAttempts: 2, Jitter: -time.Second},
	}

	for name, policy := range cases {
		if err := policy.validate(); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestAZeroMaxDelayCapsNothing(t *testing.T) {
	// Every field is public, so the zero value has to mean something sane: a
	// policy built as a struct literal used to back off for zero seconds.
	policy := &RetryPolicy{MaxAttempts: 5, BaseDelay: 2 * time.Second}

	for attempt, expected := range map[int]time.Duration{0: 2 * time.Second, 2: 8 * time.Second} {
		if got := policy.SleepFor(attempt); got != expected {
			t.Errorf("attempt %d: got %v, want %v", attempt, got, expected)
		}
	}
}

func TestANegativeJitterAddsNothing(t *testing.T) {
	policy := &RetryPolicy{MaxAttempts: 2, BaseDelay: time.Second, Jitter: -time.Second}

	if got := policy.SleepFor(0); got != time.Second {
		t.Errorf("got %v, want 1s rather than a panic", got)
	}
}

func TestNoRetryWithoutAPolicy(t *testing.T) {
	cases := map[string]*RetryPolicy{
		"no policy":   nil,
		"one attempt": {MaxAttempts: 1, BaseDelay: time.Millisecond},
	}

	for name, policy := range cases {
		t.Run(name, func(t *testing.T) {
			var attempts atomic.Int32
			server := serve(t, func(w http.ResponseWriter, r *http.Request) {
				attempts.Add(1)
				w.WriteHeader(520)
			})

			client := newAPIClient(newHTTPClient(Chrome136Profile()), policy)

			if _, err := client.request(context.Background(), server.URL, requestOptions{}); !errors.Is(err, ErrCloudflare) {
				t.Fatalf("got %v, want a Cloudflare error", err)
			}
			if attempts.Load() != 1 {
				t.Errorf("got %d attempts, want 1", attempts.Load())
			}
		})
	}
}

func TestDeflateRefusesABodyThatIsNotFullyConsumed(t *testing.T) {
	// Raw deflate carries neither a header nor a checksum, so a prefix that
	// happens to inflate must not pass as the whole body.
	body := append(rawDeflateBytes(t, []byte("legit body")), []byte("GARBAGEGARBAGE")...)

	if decoded, err := decompressDeflate(body, MaxResponseBytes); err == nil {
		t.Errorf("got %q with no error, want the partial decode refused", decoded)
	}

	// The zlib wrapper vouches for its own body, so padding stays tolerated.
	padded := append(zlibBytes(t, []byte("legit body")), 0, 0, 0)

	if decoded, err := decompressDeflate(padded, MaxResponseBytes); err != nil {
		t.Errorf("got %v, want the zlib body to survive its padding (decoded %q)", err, decoded)
	}
}

func TestTheLimitErrorNamesTheBudget(t *testing.T) {
	// Across members the message used to report what was left of the budget.
	body := append(gzipBytes(t, []byte("aaaa")), gzipBytes(t, []byte("bbbbbbbbbb"))...)
	_, err := decompressGzip(body, 10)

	if err == nil {
		t.Fatal("expected a decompression limit error")
	}
	if !strings.Contains(err.Error(), "10 byte") {
		t.Errorf("got %q, want the 10 byte budget named", err)
	}
}

func TestATransportFailureCarriesThePackageSentinel(t *testing.T) {
	// The taxonomy documented on ErrFlightRadar says every error here wraps it.
	_, err := testClient().request(context.Background(), "http://127.0.0.1:9/", requestOptions{})

	if !errors.Is(err, ErrFlightRadar) {
		t.Errorf("got %v, want it to match ErrFlightRadar", err)
	}

	// The transport's own cause has to survive, or the retry policy goes blind.
	var urlErr *url.Error

	if !errors.As(err, &urlErr) {
		t.Errorf("got %v, want the url.Error underneath", err)
	}
	if !isTransient(err) {
		t.Error("a network failure must still read as transient")
	}
}

// deadlineRecorder reads the deadline of the outgoing request, which is where
// the client-side timeout lives: it never travels to the server.
type deadlineRecorder struct {
	base     http.RoundTripper
	deadline time.Time
	set      bool
}

func (d *deadlineRecorder) RoundTrip(request *http.Request) (*http.Response, error) {
	d.deadline, d.set = request.Context().Deadline()
	return d.base.RoundTrip(request)
}

func TestANegativeTimeoutFallsBackToTheDefault(t *testing.T) {
	// Client.Timeout is public and documented as "zero or less means the
	// default", so a negative value must not leave the request unbounded.
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	recorder := &deadlineRecorder{base: newHTTPClient(Chrome136Profile()).Transport}
	client := newAPIClient(&http.Client{Transport: recorder}, nil)

	for name, timeout := range map[string]time.Duration{"negative": -time.Second, "zero": 0} {
		recorder.set = false

		if _, err := client.request(context.Background(), server.URL, requestOptions{timeout: timeout}); err != nil {
			t.Fatalf("%s: unexpected error: %v", name, err)
		}
		if !recorder.set {
			t.Fatalf("%s: the request went out with no deadline at all", name)
		}
		if remaining := time.Until(recorder.deadline); remaining > DefaultTimeout {
			t.Errorf("%s: got %v left, want at most the %v default", name, remaining, DefaultTimeout)
		}
	}
}

func TestSleepForSurvivesTheLargestJitter(t *testing.T) {
	// Every field is public: the largest Duration there is must not panic.
	policy := &RetryPolicy{MaxAttempts: 2, BaseDelay: time.Second, Jitter: math.MaxInt64}

	if delay := policy.SleepFor(0); delay < 0 {
		t.Errorf("got %v, want a usable delay", delay)
	}

	// Nor may the sum of two values that each fit wrap round.
	huge := &RetryPolicy{MaxAttempts: 2, BaseDelay: math.MaxInt64, Jitter: math.MaxInt64}

	if delay := huge.SleepFor(0); delay < 0 {
		t.Errorf("got %v, want the sum clamped", delay)
	}
}

type replacedRoundTripper struct{}

func (replacedRoundTripper) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("not used")
}

func TestNewSurvivesAReplacedDefaultTransport(t *testing.T) {
	// Mocking libraries swap http.DefaultTransport; a type assertion on it
	// turned New() into a panic.
	original := http.DefaultTransport
	http.DefaultTransport = replacedRoundTripper{}
	t.Cleanup(func() { http.DefaultTransport = original })

	client := New()

	if client == nil {
		t.Fatal("no client")
	}

	transport, ok := newHTTPClient(Chrome136Profile()).Transport.(*http.Transport)

	if !ok {
		t.Fatal("expected this package to build its own transport")
	}
	if !transport.DisableCompression {
		t.Error("the fallback transport must still leave decoding to this package")
	}
}
