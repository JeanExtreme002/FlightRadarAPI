# Configuration

The client works with no configuration. A few options are there for when the
defaults do not fit.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Option | Name | Default |
|---|---|---|
| [Timeout](#timeout) | `timeout` (seconds) | 30 seconds |
| [Concurrency](#concurrency) | `max_workers` | 8 |
| [TLS impersonation](#tls-impersonation) | `impersonate` | Chrome 136 |
| [Retry](errors.md#retrying) | `retry` | No retry |
:::

:::{tab-item} Node.js
:sync: node

| Option | Name | Default |
|---|---|---|
| [Timeout](#timeout) | `timeout` (milliseconds) | 30 seconds |
| [Concurrency](#concurrency) | `maxWorkers` | 8 |
| [TLS impersonation](#tls-impersonation) | `impersonate` | Chrome 136 |
| [Retry](errors.md#retrying) | `retry` | No retry |
:::

:::{tab-item} Go
:sync: go

| Option | Name | Default |
|---|---|---|
| [Timeout](#timeout) | `Options.Timeout` | 30 seconds |
| [Concurrency](#concurrency) | `Options.MaxWorkers` | 8 |
| [TLS impersonation](#tls-impersonation) | `Options.TLSProfile`, `Options.HTTPClient` | Chrome 136 |
| [Retry](errors.md#retrying) | `Options.Retry` | No retry |
:::

::::

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
from FlightRadarAPI import FlightRadar24API, RetryPolicy

fr_api = FlightRadar24API(
    timeout=10,                           # seconds
    max_workers=4,
    retry=RetryPolicy(max_attempts=3),
)
```

The constructor also takes `user` and `password`, to
[log in](account.md#logging-in) right away.
:::

:::{tab-item} Node.js
:sync: node

```javascript
const { FlightRadar24API, RetryPolicy } = require("flightradarapi");

const frApi = new FlightRadar24API({
    timeout: 10000,                       // milliseconds
    maxWorkers: 4,
    retry: new RetryPolicy({ maxAttempts: 3 }),
});
```
:::

:::{tab-item} Go
:sync: go

```go
retry, err := flightradarapi.NewRetryPolicy(3)

if err != nil {
    log.Fatal(err)
}

client := flightradarapi.New(flightradarapi.Options{
    Timeout:    10 * time.Second,
    MaxWorkers: 4,
    Retry:      retry,
})
```

Every field of `Options` defaults from its zero value, so set only what you
need. `New` takes at most one `Options`.
:::
::::

## Timeout

The timeout bounds a single request, not a whole call: a call that makes several
requests, such as a flight search with details, may take longer.

It can be changed after the client is created.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
fr_api.timeout = 60   # seconds
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
frApi.timeout = 60000;   // milliseconds
```
:::

:::{tab-item} Go
:sync: go

```go
client.Timeout = 60 * time.Second
```

Change it before making calls, not while one is in flight. For a deadline over
a whole call, cancel the `context.Context` you pass to it:

```go
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
defer cancel()

airports, err := client.GetAirports(ctx, nil)
```
:::
::::

## Concurrency

Two calls fan out into many requests:

- a [flight search with details](flights.md#details-for-every-flight-at-once),
  which makes one request per flight found;
- the [airports listing](airports.md#airports-of-a-country), which makes one
  request per country and state page.

The number of workers is how many of those requests run at the same time. It can
be changed after the client is created, through `max_workers` in Python,
`maxWorkers` in Node.js and `MaxWorkers` in Go.

A higher number is faster, and more likely to be answered with a
[Cloudflare block](errors.md#cloudflare-blocks).

## TLS impersonation

FlightRadar24 sits behind Cloudflare, which tells browsers from scripts by the
way they open a TLS connection. The SDKs present the handshake of Chrome 136 by
default. Override it when FlightRadar24 updates its bot mitigation faster than
this library releases.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

`impersonate` takes the name of a
[curl_cffi](https://github.com/lexiforest/curl_cffi) browser profile. The
default is `"chrome136"`.

```python
fr_api = FlightRadar24API(impersonate="chrome")
```

The profiles available depend on the version of `curl_cffi` installed.
:::

:::{tab-item} Node.js
:sync: node

`impersonate` takes an object with any of `ciphers`, `sigalgs` and `ecdhCurve`.
What you leave out keeps the value of the bundled Chrome 136 profile.

```javascript
const frApi = new FlightRadar24API({
    impersonate: {
        ciphers: ["TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256"],
        ecdhCurve: "X25519:P-256:P-384",
    },
});
```

`ciphers` and `sigalgs` are arrays of OpenSSL names, and `ecdhCurve` is a
colon-separated string.
:::

:::{tab-item} Go
:sync: go

`Options.TLSProfile` narrows the cipher suites, the curve order and the TLS
versions the client offers. Start from the default and change what you need:

```go
profile := flightradarapi.Chrome136Profile()
profile.MinVersion = tls.VersionTLS13

client := flightradarapi.New(flightradarapi.Options{TLSProfile: &profile})
```

Go fixes its own cipher ordering, so a profile is an approximation of a browser
rather than a byte-exact fingerprint. For full impersonation, pass a client
built on [utls](https://github.com/refraction-networking/utls) or
[tls-client](https://github.com/bogdanfinn/tls-client):

```go
client := flightradarapi.New(flightradarapi.Options{
    HTTPClient: &http.Client{Transport: myImpersonatingTransport},
})
```

When you replace the HTTP client:

- set `DisableCompression` on its transport, so the SDK decodes the responses
  and can enforce its [size limit](errors.md#response-size-limit);
- leave `CheckRedirect` unset, or the cookies FlightRadar24 hands out on a
  redirect are lost;
- any `Jar` is ignored: the SDK manages the cookies itself.
:::
::::

## Logging

The SDKs log a warning when FlightRadar24 answers with something they did not
expect, such as a page whose layout changed or a country with no airports. A
warning never interrupts the call.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

Warnings go to the standard `logging` module, under the logger `FlightRadarAPI`.

```python
import logging

logging.basicConfig()                                         # show the warnings
logging.getLogger("FlightRadarAPI").setLevel(logging.ERROR)   # or silence them
```
:::

:::{tab-item} Node.js
:sync: node

The warnings are written with `console.warn`, to the standard error stream.
:::

:::{tab-item} Go
:sync: go

Warnings go to `log/slog`, through `slog.Default()` unless `SetLogger` is called.

```go
logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))

flightradarapi.SetLogger(logger)   // nil restores slog.Default()
```

The logger is set for the whole process, not per client.
:::
::::
