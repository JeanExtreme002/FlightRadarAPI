---
title: Go
description: API Documentation for Go
---

## Installation

To install the FlightRadarAPI for Go, use the following command:

```bash
go get github.com/JeanExtreme002/FlightRadarAPI/go@latest
```

## Basic Usage

Import the package and create a client:

```go
import "github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi"

client := flightradarapi.New()

// Every field's zero value means the default, so set only what you need.
client = flightradarapi.New(flightradarapi.Options{
    Timeout:    10 * time.Second,  // default: 30s
    MaxWorkers: 4,                 // default: 8
})
```

Construction cannot fail, so it needs no error handling. Every method that talks
to FlightRadar24 takes a `context.Context` and returns an `error` alongside its
result.

### Fetching Data

You can fetch various types of data using the following methods:

- **Flights list:**

    ```go
    flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{})  // Returns []*Flight
    ```

- **Airports list:**

    ```go
    // Airports of specific countries
    airports, err := client.GetAirports(ctx, []flightradarapi.Country{
        flightradarapi.CountryBrazil, flightradarapi.CountryUnitedStates,
    })

    // Pass nil to get every airport
    allAirports, err := client.GetAirports(ctx, nil)
    ```

- **Airlines list:**

    ```go
    airlines, err := client.GetAirlines(ctx)
    ```

- **Zones list:**

    ```go
    zones := client.GetZones()
    ```

### Fetching Detailed Information

Fetch more information about a specific flight or airport using the following methods:

- **Flight details:**

    ```go
    details, err := client.GetFlightDetails(ctx, flight)
    flight.SetFlightDetails(details)

    fmt.Println("Flying to", flight.Details.DestinationAirportName)
    ```

    Ask for every flight's details in one call with `FlightSearch{Details: true}`.
    Requests run `MaxWorkers` at a time (8 by default).

- **Airport details:**

    ```go
    details, err := client.GetAirportDetails(ctx, icao, 100, 1)
    ```

    !!! note
        Arrivals and departures can have a limit `flightLimit` (max value is 100) to display. When you need to reach more than 100 flights you can use the `page` parameter to view other pages.

## Advanced Usage

### Fetching Flights Above a Specific Position

Use the `GetBoundsByPoint(...)` method to fetch flights above a specific position. This method takes `latitude` and `longitude` for your position and `radius` for the distance in meters from your position to designate a tracking area.

```go
// Your point is 52°34'04.7"N 13°16'57.5"E from Google Maps and radius 2km
bounds := client.GetBoundsByPoint(52.567967, 13.282644, 2000)

flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{Bounds: bounds})
```

### Filtering Flights and Airports

Use the `GetFlights(...)` method to search for flights by airline, bounds (customized coordinates or obtained by the `GetZones()` method), aircraft registration or aircraft type.

```go
// You may also set a custom region, such as: bounds := "73,-12,-156,38"
bounds := client.GetBounds(client.GetZones()["northamerica"])

emiratesFlights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{
    Airline:      "UAE",
    AircraftType: "B77W",
    Bounds:       bounds,
})
```

A single flight can be checked against several values at once, with the optional
`min_`/`max_` prefixes for numeric comparisons:

```go
matched, err := flight.CheckInfo(map[string]any{
    "min_altitude": 6700, "max_altitude": 13000, "airline_icao": "THY",
})
```

### Building Entities From a Payload You Already Have

The constructors the Python and Node.js ports expose have counterparts here:

```go
airport := flightradarapi.NewAirportFromBasicInfo(row)      // one airports-feed row
airport = flightradarapi.NewAirportFromInfo(info)           // the "details" block
airport = flightradarapi.NewAirportFromDetails(payload)     // a GetAirportDetails payload
flight := flightradarapi.NewFlight("2e0f1a2", feedRow)      // one live-feed row
```

### Fetching Airport by ICAO or IATA

```go
luklaAirport, err := client.GetAirport(ctx, "VNLK", true)
```

### Calculating Distance Between Flights and Airports

`Flight` and `Airport` both embed `Entity`, which provides the `GetDistanceFrom(...)` method. It returns the distance between the two entities in kilometers, and an error when either of them carries no position.

```go
airport, err := client.GetAirport(ctx, "KJFK", false)
distance, err := flight.GetDistanceFrom(airport)

fmt.Printf("The flight is %.1f km away from the airport.\n", distance)
```

### Downloading Flight Data :material-information-outline:{ title="This requires a premium subscription" }

```go
if err := client.Login(ctx, "email", "password"); err != nil {
    log.Fatal(err)
}

historyData, err := client.GetHistoryData(ctx, flight, "CSV", 1706529600)
err = os.WriteFile("history_data.csv", []byte(historyData), 0o644)
```

!!! warning inline end
    If an invalid time is provided, a blank document will be returned.

| Parameter  | Description |
| ------------- | ------------- |
| `flight`  | The flight to download. This can be obtained from any other function that returns flights.  |
| `fileType`  | The format of the file to download. This can be either "CSV" or "KML".  |
| `timestamp`  | The scheduled time of departure (STD) of the flight in UTC, as a Unix timestamp.  |

### Setting and Getting Real-time Flight Tracker Parameters

Set them with the `SetFlightTrackerConfig(...)` method. It takes a `*FlightTrackerConfig` and a map of single values; either may be `nil`. Unknown options and non-numeric values are rejected, and a rejected update leaves the current config untouched.

Get the current configuration with `GetFlightTrackerConfig()`, which returns a copy. Note: `NewFlightTrackerConfig()` means resetting all parameters to default.

```go
config := client.GetFlightTrackerConfig()
config.Limit = "10"

err := client.SetFlightTrackerConfig(&config, nil)

flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{})  // Returns only 10 flights
```

### Handling Errors

Every error wraps a sentinel, so both `errors.Is` and `errors.As` work:

```go
airport, err := client.GetAirport(ctx, "XXX", false)

switch {
case errors.Is(err, flightradarapi.ErrAirportNotFound):
    // no such airport
case errors.Is(err, flightradarapi.ErrCloudflare):
    // blocked by Cloudflare
case errors.Is(err, flightradarapi.ErrLogin):
    // the endpoint needs an account
}
```

Transient failures — a Cloudflare block, a timeout, a network error — can be
retried with exponential backoff:

```go
retry, err := flightradarapi.NewRetryPolicy(3)
client := flightradarapi.New(flightradarapi.Options{Retry: retry})
```

### Configuring the Client

Every field of `Options` defaults from its zero value, so set only what you need:

```go
retry, err := flightradarapi.NewRetryPolicy(3)  // 1s base, 30s cap, 500ms jitter

client := flightradarapi.New(flightradarapi.Options{
    Timeout:    10 * time.Second,  // default: 30s
    MaxWorkers: 4,                 // default: 8
    Retry:      retry,             // default: no retry
})
```

### TLS Impersonation

FlightRadar24 fingerprints TLS handshakes through Cloudflare. The default client
narrows Go's offered cipher suites and curve order to Chrome's, which is enough
today. Since Go fixes its own cipher ordering, that is an approximation rather
than a byte-exact fingerprint; for full impersonation, pass a client built on
[utls](https://github.com/refraction-networking/utls) or
[tls-client](https://github.com/bogdanfinn/tls-client):

```go
client := flightradarapi.New(flightradarapi.Options{
    HTTPClient: &http.Client{Transport: myImpersonatingTransport},
})
```

## Differences from the Python and Node.js Packages

The behavior is the same; the surface is Go-shaped.

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
parameters, kept that way by a test that reads the Python source.
