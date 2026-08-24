package flightradarapi

import (
	"errors"
	"fmt"
	"net/http"
)

// Sentinels for the package's error taxonomy. Every error returned by this
// package wraps ErrFlightRadar, so errors.Is(err, ErrFlightRadar) matches all of
// them — the counterpart of catching the FlightRadarError base class in the
// Python and Node.js SDKs.
var (
	ErrFlightRadar        = errors.New("flightradar24")
	ErrAirportNotFound    = fmt.Errorf("%w: airport not found", ErrFlightRadar)
	ErrCloudflare         = fmt.Errorf("%w: blocked by cloudflare", ErrFlightRadar)
	ErrDecompressionLimit = fmt.Errorf("%w: response body past the size limit", ErrFlightRadar)
	ErrLogin              = fmt.Errorf("%w: login", ErrFlightRadar)
)

// AirportNotFoundError reports a code no airport answered to.
type AirportNotFoundError struct {
	Code    string
	Message string
	// Errors carries the FR24 validation payload, when the API returned one.
	Errors map[string]any
}

func (e *AirportNotFoundError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("could not find an airport by the code %q", e.Code)
}

func (e *AirportNotFoundError) Unwrap() error { return ErrAirportNotFound }

// CloudflareError reports a block by Cloudflare rather than by the FR24 origin.
type CloudflareError struct {
	Message string
	// Response is the blocked response, with Body already drained.
	Response *http.Response
	// Body is the challenge page, kept readable after the drain.
	Body []byte
}

func (e *CloudflareError) Error() string { return e.Message }

func (e *CloudflareError) Unwrap() error { return ErrCloudflare }

// DecompressionLimitError reports a body that grew past the size budget.
type DecompressionLimitError struct {
	Message string
}

func (e *DecompressionLimitError) Error() string { return e.Message }

func (e *DecompressionLimitError) Unwrap() error { return ErrDecompressionLimit }

// LoginError reports a failed login, or an authenticated endpoint reached
// without one.
type LoginError struct {
	Message string
}

func (e *LoginError) Error() string { return e.Message }

func (e *LoginError) Unwrap() error { return ErrLogin }

// StatusError reports a status code the caller did not allow.
type StatusError struct {
	StatusCode int
	Status     string
	URL        string
	Body       []byte
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("received status code %q for the URL %s", e.Status, e.URL)
}

func (e *StatusError) Unwrap() error { return ErrFlightRadar }
