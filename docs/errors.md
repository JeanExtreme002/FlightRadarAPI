# Errors and Retries

## The errors of the SDK

Every error the SDK defines shares one base, so a single handler can catch them
all.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Error | Raised when |
|---|---|
| `FlightRadarError` | Base of all the errors below |
| `AirportNotFoundError` | No airport answers to the code given |
| `CloudflareError` | Cloudflare blocked the request |
| `LoginError` | The login failed, or the call needs a session and there is none |
| `DecompressionLimitError` | A response is larger than the [size limit](#response-size-limit) |
:::

:::{tab-item} Node.js
:sync: node

| Error | Raised when |
|---|---|
| `FlightRadarError` | Base of all the errors below |
| `AirportNotFoundError` | No airport answers to the code given |
| `CloudflareError` | Cloudflare blocked the request |
| `LoginError` | The login failed, or the call needs a session and there is none |
| `DecompressionLimitError` | A response is larger than the [size limit](#response-size-limit) |
:::

:::{tab-item} Go
:sync: go

| Sentinel | Type | Raised when |
|---|---|---|
| `ErrFlightRadar` |  | Base of all the errors below |
| `ErrAirportNotFound` | `*AirportNotFoundError` | No airport answers to the code given |
| `ErrCloudflare` | `*CloudflareError` | Cloudflare blocked the request |
| `ErrLogin` | `*LoginError` | The login failed, or the call needs a session and there is none |
| `ErrDecompressionLimit` | `*DecompressionLimitError` | A response is larger than the [size limit](#response-size-limit) |
:::
::::

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

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

`error.response` is the response object, with the challenge page as its content.
:::

:::{tab-item} Node.js
:sync: node

`error.response` is the response object, and `error.body` is the challenge page,
as text.
:::

:::{tab-item} Go
:sync: go

In a `*CloudflareError`, `Response` is the `*http.Response` and `Body` is the
challenge page, as bytes.
:::
::::

When blocks keep happening:

1. Slow down. Lower the [number of workers](client.md#concurrency) and space
   your calls.
2. Add a [retry policy](#retrying), which backs off between attempts.
3. Update the package, or override the
   [TLS impersonation](client.md#tls-impersonation).

## Retrying

By default a failed request is not retried. A `RetryPolicy` retries the
failures that may go away on their own, such as a Cloudflare block or a timeout,
with an exponential backoff.

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

Retried: a `CloudflareError` and every `curl_cffi` request error. That includes
timeouts and network errors, and also an unexpected status code, such as a 404
or a 500, which is retried like the rest.
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

Retried: a `CloudflareError`, a timeout and a connection reset. An unexpected
status code is not.
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

Retried: a Cloudflare block, a timeout and a network error. An unexpected
status code and a cancelled context are not.
:::
::::

The wait doubles after each attempt, up to the maximum: with the defaults, about
1, 2, 4, 8 seconds and so on, each plus the jitter. When every attempt fails,
the last error is the one you get.

An airport that does not exist, a failed login or an oversized response is
never retried.

## Response size limit

A response body is limited to 64 MiB once decompressed. A body past the limit
fails with `DecompressionLimitError` (`ErrDecompressionLimit` in Go) instead of
exhausting memory. Nothing FlightRadar24 legitimately sends comes close to it.

Python and Go also apply the limit to the compressed body as it arrives. Node.js
counts the decompressed bytes only.

## Other failures

Not every failure is one of the errors above. Invalid arguments are rejected
with the error the language uses for them, and HTTP and network failures come
from the transport.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Situation | Error |
|---|---|
| Airport code that is not 3 or 4 characters long | `ValueError` |
| Flight limit of the airport details out of range | `ValueError` |
| File type of the flight history other than CSV or KML | `ValueError` |
| Unknown flight tracker option | `KeyError` |
| Flight tracker value that is not a number | `TypeError` |
| Distance between entities without a position | `ValueError`, or `TypeError` (see [Distances](distances.md#entities-without-a-position)) |
| Countries that are neither a string nor an iterable | `TypeError` |
| Unexpected status code | `curl_cffi` `HTTPError` |
| Timeout | `curl_cffi` `Timeout` |
| Network error | `curl_cffi` `RequestsError` |

The last three are subclasses of `curl_cffi.requests.errors.RequestsError`.
:::

:::{tab-item} Node.js
:sync: node

| Situation | Error |
|---|---|
| Airport code that is not 3 or 4 characters long | `TypeError` |
| Flight limit of the airport details out of range | `RangeError` |
| File type of the flight history other than CSV or KML | `TypeError` |
| Unknown flight tracker option | `RangeError` |
| Flight tracker value that is not a number | `TypeError` |
| Distance between entities without a position | `TypeError`, or no error and `NaN` (see [Distances](distances.md#entities-without-a-position)) |
| Countries that are neither a string nor an iterable | `TypeError` |
| Unexpected status code | `Error`, with the status in its message |
| Timeout | `Error` named `TimeoutError` |
| Network error | the error of `fetch` |
:::

:::{tab-item} Go
:sync: go

| Situation | Error |
|---|---|
| Invalid argument | plain error |
| Unexpected status code | `*StatusError` |
| Timeout | error matching `context.DeadlineExceeded` |
| Network error | error wrapping a `*url.Error` |

All of them wrap `ErrFlightRadar`. A `*StatusError` carries the `StatusCode`,
`Status`, `URL` and `Body` of the response.
:::
::::
