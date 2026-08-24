# FlightRadarAPI
Unofficial SDK for [FlightRadar24](https://www.flightradar24.com/) for Go.

This SDK should only be used for your own educational purposes. If you are interested in accessing Flightradar24 data commercially, please contact business@fr24.com. See more information at [Flightradar24's terms and conditions](https://www.flightradar24.com/terms-and-conditions).

**Official FR24 API**: https://fr24api.flightradar24.com/

[![Go Package](https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/go-package.yml/badge.svg)](https://github.com/JeanExtreme002/FlightRadarAPI/actions)
[![Go Reference](https://pkg.go.dev/badge/github.com/JeanExtreme002/FlightRadarAPI/go.svg)](https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi)
[![License](https://img.shields.io/pypi/l/FlightRadarAPI)](https://github.com/JeanExtreme002/FlightRadarAPI)
[![Go Version](https://img.shields.io/badge/go-1.25+-00ADD8)](https://go.dev/dl/)

## Installing FlightRadarAPI

```bash
go get github.com/JeanExtreme002/FlightRadarAPI/go@latest
```

The module lives in a subdirectory of the repository, so its releases are the
tags prefixed with it (`go/v1.6.0`). To track the branch instead:

```bash
go get github.com/JeanExtreme002/FlightRadarAPI/go@main
```

## Basic Usage

Create a client and call its methods. Construction cannot fail, so it needs no
error handling; every method that talks to FR24 takes a `context.Context` and
returns an error.

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi"
)

func main() {
	client := flightradarapi.New()

	flights, err := client.GetFlights(context.Background(), flightradarapi.FlightSearch{})
	if err != nil {
		log.Fatal(err)
	}

	for _, flight := range flights[:min(5, len(flights))] {
		fmt.Println(flight, flight.GetFlightLevel())
	}
}
```

**Getting flights list:**
```go
flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{})  // Returns []*Flight
```

**Getting airports list:**
```go
// Get airports from specific countries
airports, err := client.GetAirports(ctx, []flightradarapi.Country{
	flightradarapi.CountryBrazil, flightradarapi.CountryUnitedStates,
})

// Pass nil to get every airport
allAirports, err := client.GetAirports(ctx, nil)
```

**Getting airlines list:**
```go
airlines, err := client.GetAirlines(ctx)  // Returns []Airline with IATA/ICAO codes
```

**Getting zones list:**
```go
zones := client.GetZones()
```

**Using the Country constants:**
```go
flightradarapi.CountryUnitedStates  // "united-states"
flightradarapi.CountryBrazil        // "brazil"
flightradarapi.CountryGermany       // "germany"
flightradarapi.CountryFrance        // "france"
// ... and many more

// Any spelling works — values are slugified before matching.
flightradarapi.Country("Myanmar (Burma)")  // same filter as CountryMyanmarBurma

// AllCountries() enumerates them, like list(Countries) does in Python.
for _, country := range flightradarapi.AllCountries() { … }
```

## Fetching Detailed Information

```go
// Flight details
details, err := client.GetFlightDetails(ctx, flight)
flight.SetFlightDetails(details)
fmt.Println(flight.Details.AirlineName, flight.Details.OriginAirportName)

// Every flight with its details, MaxWorkers requests at a time
flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{Details: true})

// Airport details
airport, err := client.GetAirport(ctx, "ATL", true)
fmt.Println(airport.Name, airport.TimezoneName, len(airport.Runways))
```

## Advanced Usage

**Fetching flights above a specific position:**
```go
// Your point is 52°34'04.7"N 13°16'57.5"E from Google Maps and radius 2 km
bounds := client.GetBoundsByPoint(52.567774, 13.282827, 2000)

flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{Bounds: bounds})
```

**Filtering flights and airports:**
```go
airportBounds := client.GetBounds(client.GetZones()["northamerica"])
// Or set a custom region: bounds := "73,-12,-156,38"

flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{
	Airline: "SWA", Bounds: airportBounds, AircraftType: "B738",
})

// Filter a flight on its values, with optional min_/max_ prefixes
matched, err := flight.CheckInfo(map[string]any{
	"min_altitude": 6700, "max_altitude": 13000, "airline_icao": "THY",
})
```

**Calculating the distance between flights and airports:**
```go
distance, err := airport.GetDistanceFrom(flight)  // In kilometers
```

**Downloading flight data** (requires a premium subscription):
```go
if err := client.Login(ctx, "email", "password"); err != nil {
	log.Fatal(err)
}

data, err := client.GetHistoryData(ctx, flight, "CSV", timestamp)
```

**Setting the Real Time Flight Tracker parameters:**
```go
// Replace the whole config, apply single values, or both
err := client.SetFlightTrackerConfig(nil, map[string]string{"limit": "10", "maxage": "600"})

config := client.GetFlightTrackerConfig()  // A copy, safe to keep
```

**Configuring the client:**
```go
retry, err := flightradarapi.NewRetryPolicy(3)  // 1s base, 30s cap, 500ms jitter

// Every field's zero value means the default, so set only what you need.
client := flightradarapi.New(flightradarapi.Options{
	Timeout:    10 * time.Second,  // default: 30s
	MaxWorkers: 4,                 // default: 8
	Retry:      retry,             // default: no retry
})
```

## Building Entities Yourself

The constructors the Python and Node.js ports expose have counterparts here, for
payloads you already hold:

```go
airport := flightradarapi.NewAirportFromBasicInfo(row)      // one airports-feed row
airport = flightradarapi.NewAirportFromInfo(info)           // the "details" block
airport = flightradarapi.NewAirportFromDetails(payload)     // a GetAirportDetails payload
flight := flightradarapi.NewFlight("2e0f1a2", feedRow)      // one live-feed row
```

## Error Handling

Every error wraps a sentinel, so `errors.Is` and `errors.As` both work:

```go
airport, err := client.GetAirport(ctx, "XXX", false)

switch {
case errors.Is(err, flightradarapi.ErrAirportNotFound):
	// no such airport
case errors.Is(err, flightradarapi.ErrCloudflare):
	// blocked by Cloudflare — back off, or plug in TLS impersonation
case errors.Is(err, flightradarapi.ErrLogin):
	// the endpoint needs an account
}

var cloudflareErr *flightradarapi.CloudflareError

if errors.As(err, &cloudflareErr) {
	fmt.Println(string(cloudflareErr.Body))  // the challenge page
}
```

## TLS Impersonation

FR24 fronts its site with Cloudflare, which fingerprints TLS handshakes. The
default client narrows Go's offered cipher suites and curve order to Chrome's
([`Chrome136Profile`](flightradarapi/request.go)), which is enough today.
Go fixes its own cipher ordering, so this is an approximation rather than a
byte-exact JA3. For full impersonation, plug in a client built on
[utls](https://github.com/refraction-networking/utls) or
[tls-client](https://github.com/bogdanfinn/tls-client):

```go
client := flightradarapi.New(flightradarapi.Options{
	HTTPClient: &http.Client{Transport: myImpersonatingTransport},
})
```

Set `DisableCompression` on your transport so this package keeps owning content
decoding, and with it the response size budget. Leave `CheckRedirect` unset too,
or the cookies FR24 hands out on a redirect hop are not banked.

## Differences from the Python and Node.js ports

The features are the same; the names differ only where Go's conventions do. The
package name is part of every identifier, so the client is `Client` rather than
`FlightRadar24API` — the way it is `http.Client` and not `http.HTTPClient`.

| Python / Node.js | Go |
| --- | --- |
| `FlightRadar24API` | `Client`, built with `New` |
| `new FlightRadar24API({timeout, maxWorkers})` | `New(Options{Timeout: ..., MaxWorkers: ...})` |
| `FlightRadarError` (base class) | `ErrFlightRadar`, wrapped by every error here |
| `Countries.BRAZIL` | `CountryBrazil`, with `AllCountries()` to enumerate |
| `FlightRadar24API(user, password)` logs in (Python only) | `client.Login(ctx, user, password)` |
| `get_flights(airline, bounds, registration, aircraft_type, details)` | `GetFlights(ctx, FlightSearch{...})` |
| `check_info(min_altitude=6700)` | `CheckInfo(map[string]any{"min_altitude": 6700})` |
| `Airport.from_details(payload)` | `NewAirportFromDetails(payload)` |
| `(bytes, extension)` tuple | `*Image` |
| `airline["n_aircrafts"]` | `Airline.NumAircrafts` |
| `flight.destination_airport_name` | `flight.Details.DestinationAirportName` |
| default arguments (`flight_limit=100`, `limit=50`) | zero means the same default |
| `get_airports(None)` for every airport | `GetAirports(ctx, nil)` |
| exceptions | `error` values wrapping `ErrFlightRadar` |
| missing value is the string `"N/A"` | zero value: `""` or a nil pointer |
| `parsers` module (internal) | unexported functions |
| blocking calls | `context.Context` on every request |

Every method of `FlightRadar24API` has a counterpart here, with the same
parameters — `ports_test.go` reads the Python source and fails if that stops
being true.

## Documentation

Explore the documentation of the FlightRadarAPI package through
[this site](https://JeanExtreme002.github.io/FlightRadarAPI/), or read the
[Go reference](https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi).

## Development

```bash
cd go
make deps
make test              # offline suite (the PR gate)
make test-integration  # live FR24 suite
make lint              # gofmt + go vet
make lint-strict       # adds staticcheck
make test-coverage
```

`countries.go` and `zones.go` are generated from the Python port;
`ports_test.go` fails when the two drift apart.
