# Errors and Retries

## The errors of the SDK

Every error the SDK defines shares one base, so a single handler can catch them
all.

| Python and Node.js | Go sentinel | Go type | Raised when |
|---|---|---|---|
| `FlightRadarError` | `ErrFlightRadar` | | Base of all the errors below |
| `AirportNotFoundError` | `ErrAirportNotFound` | `*AirportNotFoundError` | No airport answers to the code given |
| `CloudflareError` | `ErrCloudflare` | `*CloudflareError` | Cloudflare blocked the request |
| `LoginError` | `ErrLogin` | `*LoginError` | The login failed, or the call needs a session and there is none |
| `DecompressionLimitError` | `ErrDecompressionLimit` | `*DecompressionLimitError` | A response is larger than the [size limit](#response-size-limit) |

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
from FlightRadarAPI import (
    AirportNotFoundError, CloudflareError, FlightRadarError, LoginError,
)

try:
    airport = fr_api.get_airport("XXXX")
except AirportNotFoundError:
    print("No such airport")
except CloudflareError as error:
    print("Blocked by Cloudflare:", error.response.status_code)
except FlightRadarError as error:
    print("FlightRadarAPI failed:", error)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const {
    AirportNotFoundError, CloudflareError, FlightRadarError,
} = require("flightradarapi");

try {
    const airport = await frApi.getAirport("XXXX");
}
catch (error) {
    if (error instanceof AirportNotFoundError) {
        console.log("No such airport");
    }
    else if (error instanceof CloudflareError) {
        console.log("Blocked by Cloudflare:", error.response.status);
    }
    else if (error instanceof FlightRadarError) {
        console.log("FlightRadarAPI failed:", error.message);
    }
    else {
        throw error;
    }
}
```
:::

:::{tab-item} Go
:sync: go

Every error wraps a sentinel, so both `errors.Is` and `errors.As` work:

```go
airport, err := client.GetAirport(ctx, "XXXX", false)

switch {
case errors.Is(err, flightradarapi.ErrAirportNotFound):
    // no such airport
case errors.Is(err, flightradarapi.ErrCloudflare):
    // blocked by Cloudflare
case errors.Is(err, flightradarapi.ErrLogin):
    // the call needs an account
case errors.Is(err, flightradarapi.ErrFlightRadar):
    // anything else from this package
}
```

Use `errors.As` to read what an error carries:

```go
var blocked *flightradarapi.CloudflareError

if errors.As(err, &blocked) {
    fmt.Println(blocked.Response.StatusCode, len(blocked.Body))
}
```
:::
::::

## Cloudflare blocks

FlightRadar24 sits behind Cloudflare, which may block a client that makes too
many calls or that does not look like a browser. The SDK reports it as a
`CloudflareError` when the response is one of:

- an HTTP 520;
- an HTTP 403 carrying the `cf-mitigated` header, which Cloudflare sets when it
  was Cloudflare, and not FlightRadar24, that refused the request.

The error carries the blocked response, for inspection:

| SDK | What the error carries |
|---|---|
| Python | `error.response`: the response object, with the challenge page as its content |
| Node.js | `error.response`: the response object; `error.body`: the challenge page, as text |
| Go | `Response`: the `*http.Response`; `Body`: the challenge page, as bytes |

When blocks keep happening:

1. Slow down. Lower the [number of workers](client.md#concurrency) and space
   your calls.
2. Add a [retry policy](#retrying), which backs off between attempts.
3. Update the package, or override the
   [TLS impersonation](client.md#tls-impersonation).

## Retrying

By default a failed request is not retried. A `RetryPolicy` retries the
transient failures (a Cloudflare block, a timeout, a network error) with an
exponential backoff.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
from FlightRadarAPI import FlightRadar24API, RetryPolicy

fr_api = FlightRadar24API(retry=RetryPolicy(max_attempts=3))
```

| Parameter | Default | Meaning |
|---|---|---|
| `max_attempts` | `1` | Total number of attempts, including the first |
| `base_delay` | `1.0` | Seconds to wait before the second attempt |
| `max_delay` | `30.0` | Longest wait between attempts, in seconds |
| `jitter` | `0.5` | Upper bound of the random seconds added to each wait |

A `max_attempts` below 1 or a negative delay raises `ValueError`.
:::

:::{tab-item} Node.js
:sync: node

```javascript
const { FlightRadar24API, RetryPolicy } = require("flightradarapi");

const frApi = new FlightRadar24API({ retry: new RetryPolicy({ maxAttempts: 3 }) });
```

| Option | Default | Meaning |
|---|---|---|
| `maxAttempts` | `1` | Total number of attempts, including the first |
| `baseDelayMs` | `1000` | Milliseconds to wait before the second attempt |
| `maxDelayMs` | `30000` | Longest wait between attempts, in milliseconds |
| `jitterMs` | `500` | Upper bound of the random milliseconds added to each wait |

A `maxAttempts` below 1 or a negative delay throws an `Error`.
:::

:::{tab-item} Go
:sync: go

```go
retry, err := flightradarapi.NewRetryPolicy(3)

if err != nil {
    log.Fatal(err)
}

client := flightradarapi.New(flightradarapi.Options{Retry: retry})
```

`NewRetryPolicy` takes the number of attempts and uses the defaults for the
rest. For other values, write the struct:

```go
retry := &flightradarapi.RetryPolicy{
    MaxAttempts: 5,
    BaseDelay:   2 * time.Second,
    MaxDelay:    time.Minute,
    Jitter:      250 * time.Millisecond,
}
```

| Field | `NewRetryPolicy` | Meaning |
|---|---|---|
| `MaxAttempts` | the argument | Total number of attempts, including the first |
| `BaseDelay` | `1s` | Wait before the second attempt. Zero means `1s`. |
| `MaxDelay` | `30s` | Longest wait between attempts. Zero means `30s`. |
| `Jitter` | `500ms` | Upper bound of the random time added to each wait. Zero means none. |

`NewRetryPolicy` returns an error for a number of attempts below 1.
:::
::::

The wait doubles after each attempt, up to the maximum: with the defaults, about
1, 2, 4, 8 seconds and so on, each plus the jitter. When every attempt fails,
the last error is the one you get.

Only transient failures are retried. An airport that does not exist, a failed
login or an oversized response fails at once.

## Response size limit

A response body is limited to 64 MiB, both as it arrives and after it is
decompressed. A body past the limit fails with `DecompressionLimitError`
(`ErrDecompressionLimit` in Go) instead of exhausting memory. Nothing
FlightRadar24 legitimately sends comes close to it.

## Other failures

Not every failure is one of the errors above.

**Invalid arguments** are rejected with the error the language uses for them:

| Situation | Python | Node.js |
|---|---|---|
| Airport code that is not 3 or 4 characters long | `ValueError` | `TypeError` |
| Flight limit of the airport details out of range | `ValueError` | `RangeError` |
| File type of the flight history other than CSV or KML | `ValueError` | `TypeError` |
| Unknown flight tracker option | `KeyError` | `RangeError` |
| Flight tracker value that is not a number | `TypeError` | `TypeError` |
| Distance between entities without a position | `ValueError` | `TypeError` |
| Countries that are neither a string nor an iterable | `TypeError` | `TypeError` |

In Go, all of these are plain errors that wrap `ErrFlightRadar`.

**HTTP and network failures** come from the transport:

| Situation | Python | Node.js | Go |
|---|---|---|---|
| Unexpected status code | `curl_cffi` `HTTPError` | `Error`, with the status in its message | `*StatusError` |
| Timeout | `curl_cffi` `Timeout` | `Error` named `TimeoutError` | error matching `context.DeadlineExceeded` |
| Network error | `curl_cffi` `RequestsError` | the error of `fetch` | error wrapping a `*url.Error` |

In Python these are all subclasses of `curl_cffi.requests.errors.RequestsError`.
In Go they wrap `ErrFlightRadar` like every other error of the package, and a
`*StatusError` carries the `StatusCode`, `Status`, `URL` and `Body` of the
response.
