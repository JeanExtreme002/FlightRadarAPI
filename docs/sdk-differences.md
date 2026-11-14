# Differences Between the SDKs

The three SDKs carry the same features and behave the same way. What changes is
the shape each language gives them.

## At a glance

| | Python | Node.js | Go |
|---|---|---|---|
| Package | `FlightRadarAPI` | `flightradarapi` | `github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi` |
| Client | `FlightRadar24API()` | `new FlightRadar24API()` | `flightradarapi.New()`, a `*Client` |
| Client options | keyword arguments | one options object | one `Options` struct |
| Names | `snake_case` | `camelCase` | `PascalCase` |
| Calls | blocking | `Promise` | `context.Context` in, `error` out |
| Timeout unit | seconds | milliseconds | `time.Duration` |
| Retry delays | seconds | milliseconds | `time.Duration` |
| Failures | exceptions | exceptions | `error` values |
| Missing value | `"N/A"` or `None` | `"N/A"` or `null` | zero value: `""` or `nil` |
| Log in at construction | yes, with `user` and `password` | no | no |

## Python and Node.js

The two are close. The differences are in how arguments are passed:

| | Python | Node.js |
|---|---|---|
| Flight search | `get_flights(airline="UAE", aircraft_type="B77W")` | `getFlights("UAE", null, null, "B77W")` |
| Details flag | keyword-only: `get_airport("VNLK", details=True)` | positional: `getAirport("VNLK", true)` |
| Tracker options | `set_flight_tracker_config(limit=10)` | `setFlightTrackerConfig(null, { limit: 10 })` |
| Checking a flight | `check_info(min_altitude=6700)` | `checkInfo({ minAltitude: 6700 })` |
| TLS impersonation | name of a `curl_cffi` profile | object with `ciphers`, `sigalgs`, `ecdhCurve` |
| Unknown tracker option | `KeyError` | `RangeError` |
| Invalid airport code or file type | `ValueError` | `TypeError` |

## Go

The Go package follows the conventions of the language, so its surface differs
more. The package name is part of every identifier, which is why the client is
`Client` rather than `FlightRadar24API`: the way it is `http.Client` and not
`http.HTTPClient`.

| Python and Node.js | Go |
|---|---|
| `FlightRadar24API` | `Client`, built with `New` |
| `FlightRadar24API(timeout=..., max_workers=...)` | `New(Options{Timeout: ..., MaxWorkers: ...})` |
| `FlightRadar24API(user, password)` logs in (Python only) | `client.Login(ctx, user, password)` |
| blocking calls and promises | `context.Context` on every request |
| exceptions | `error` values wrapping `ErrFlightRadar` |
| `FlightRadarError` (base class) | `ErrFlightRadar`, wrapped by every error |
| `Countries.BRAZIL` | `CountryBrazil`, with `AllCountries()` to enumerate |
| `get_flights(airline, bounds, registration, aircraft_type, details)` | `GetFlights(ctx, FlightSearch{...})` |
| `get_airports()` for every airport | `GetAirports(ctx, nil)` |
| default arguments (`flight_limit=100`, `limit=50`) | zero means the same default |
| `set_flight_tracker_config(config, limit=10)` | `SetFlightTrackerConfig(&config, map[string]string{"limit": "10"})` |
| `check_info(min_altitude=6700)` | `CheckInfo(map[string]any{"min_altitude": 6700})` |
| `check_info` ignores a name the flight does not have | `CheckInfo` returns an error for it |
| `flight.destination_airport_name` | `flight.Details.DestinationAirportName` |
| `Airport.from_details(payload)` | `NewAirportFromDetails(payload)` |
| `Flight(flight_id, info)` | `NewFlight(flightID, info)` |
| `(bytes, extension)` tuple | `*Image`, with `Data` and `Extension` |
| airline as a dictionary: `airline["n_aircrafts"]` | `Airline` struct: `airline.NumAircrafts` |
| zone as a dictionary: `zone["tl_y"]`, `zone["subzones"]` | `Zone` struct: `zone.TLY`, `zone.Subzones` |
| missing value is the string `"N/A"` | zero value: `""` or a nil pointer |
| `impersonate` | `Options.TLSProfile`, or a whole `Options.HTTPClient` |
| warnings through `logging` and `console.warn` | warnings through `log/slog`, see `SetLogger` |
| `parsers` module (internal) | unexported functions |

Every method of `FlightRadar24API` has a counterpart in `Client`, with the same
parameters, kept that way by a test that reads the Python source.

The Go package is also documented on
[pkg.go.dev](https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi),
from its source.
