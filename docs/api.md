# Client Methods

The client is the entry point of each SDK: `FlightRadar24API` in Python and
Node.js, `Client` in Go. Its methods are the same in the three languages, apart
from the naming convention of each.

This page lists every one of them. The linked guides explain them with examples.

## Signatures

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
class FlightRadar24API:
    timeout: int        # seconds
    max_workers: int

    def __init__(self, user=None, password=None, timeout=30, max_workers=8,
                 impersonate=None, retry=None)

    # Flights
    def get_flights(self, airline=None, bounds=None, registration=None,
                    aircraft_type=None, *, details=False) -> list[Flight]
    def get_flight_details(self, flight: Flight) -> dict
    def get_flight_tracker_config(self) -> FlightTrackerConfig
    def set_flight_tracker_config(self, flight_tracker_config=None, **config) -> None

    # Zones and bounds
    def get_zones(self) -> dict
    def get_bounds(self, zone: dict) -> str
    def get_bounds_by_point(self, latitude: float, longitude: float, radius: float) -> str

    # Airports
    def get_airport(self, code: str, *, details=False) -> Airport
    def get_airport_details(self, code: str, flight_limit=100, page=1) -> dict
    def get_airports(self, countries=None) -> list[Airport]
    def get_airport_disruptions(self) -> dict

    # Airlines and images
    def get_airlines(self) -> list[dict]
    def get_airline_logo(self, iata: str, icao: str) -> tuple[bytes, str] | None
    def get_country_flag(self, country: str) -> tuple[bytes, str] | None

    # More data
    def search(self, query: str, limit=50) -> dict
    def get_most_tracked(self) -> dict
    def get_volcanic_eruptions(self) -> dict

    # Account
    def login(self, user: str, password: str) -> None
    def logout(self) -> bool
    def is_logged_in(self) -> bool
    def get_login_data(self) -> dict
    def get_bookmarks(self) -> dict
    def get_history_data(self, flight: Flight, file_type: str, timestamp: int) -> str
```

`details` is keyword-only in `get_flights` and `get_airport`.
:::

:::{tab-item} Node.js
:sync: node

```typescript
class FlightRadar24API {
    timeout: number;        // milliseconds
    maxWorkers: number;

    constructor(options?: { timeout?: number; maxWorkers?: number; impersonate?: object; retry?: RetryPolicy });

    // Flights
    getFlights(airline?: string | null, bounds?: string | null, registration?: string | null,
               aircraftType?: string | null, details?: boolean): Promise<Flight[]>;
    getFlightDetails(flight: Flight): Promise<object>;
    getFlightTrackerConfig(): FlightTrackerConfig;
    setFlightTrackerConfig(flightTrackerConfig: FlightTrackerConfig | null, config?: object): void;

    // Zones and bounds
    getZones(): object;
    getBounds(zone: Zone): string;
    getBoundsByPoint(latitude: number, longitude: number, radius: number): string;

    // Airports
    getAirport(code: string, details?: boolean): Promise<Airport>;
    getAirportDetails(code: string, flightLimit?: number, page?: number): Promise<object>;
    getAirports(countries?: Iterable<string> | string): Promise<Airport[]>;
    getAirportDisruptions(): Promise<object>;

    // Airlines and images
    getAirlines(): Promise<object[]>;
    getAirlineLogo(iata: string, icao: string): Promise<[ArrayBuffer, string] | null>;
    getCountryFlag(country: string): Promise<[ArrayBuffer, string] | null>;

    // More data
    search(query: string, limit?: number): Promise<Record<string, object[]>>;
    getMostTracked(): Promise<object>;
    getVolcanicEruptions(): Promise<object>;

    // Account
    login(user: string, password: string): Promise<void>;
    logout(): Promise<boolean>;
    isLoggedIn(): boolean;
    getLoginData(): object;
    getBookmarks(): Promise<object>;
    getHistoryData(flight: Flight, fileType: "CSV" | "KML", timestamp: number): Promise<any>;
}
```

The defaults are the same as in Python: `flightLimit = 100`, `page = 1`,
`limit = 50`, `details = false`.
:::

:::{tab-item} Go
:sync: go

```go
func New(options ...Options) *Client

type Client struct {
    Timeout    time.Duration
    MaxWorkers int
}

// Flights
func (c *Client) GetFlights(ctx context.Context, search FlightSearch) ([]*Flight, error)
func (c *Client) GetFlightDetails(ctx context.Context, flight *Flight) (map[string]any, error)
func (c *Client) GetFlightTrackerConfig() FlightTrackerConfig
func (c *Client) SetFlightTrackerConfig(config *FlightTrackerConfig, values map[string]string) error

// Zones and bounds
func (c *Client) GetZones() map[string]Zone
func (c *Client) GetBounds(zone Zone) string
func (c *Client) GetBoundsByPoint(latitude, longitude, radius float64) string

// Airports
func (c *Client) GetAirport(ctx context.Context, code string, details bool) (*Airport, error)
func (c *Client) GetAirportDetails(ctx context.Context, code string, flightLimit, page int) (map[string]any, error)
func (c *Client) GetAirports(ctx context.Context, countries []Country) ([]*Airport, error)
func (c *Client) GetAirportDisruptions(ctx context.Context) (map[string]any, error)

// Airlines and images
func (c *Client) GetAirlines(ctx context.Context) ([]Airline, error)
func (c *Client) GetAirlineLogo(ctx context.Context, iata, icao string) (*Image, error)
func (c *Client) GetCountryFlag(ctx context.Context, country string) (*Image, error)

// More data
func (c *Client) Search(ctx context.Context, query string, limit int) (map[string][]any, error)
func (c *Client) GetMostTracked(ctx context.Context) (map[string]any, error)
func (c *Client) GetVolcanicEruptions(ctx context.Context) (map[string]any, error)

// Account
func (c *Client) Login(ctx context.Context, user, password string) error
func (c *Client) Logout(ctx context.Context) (bool, error)
func (c *Client) IsLoggedIn() bool
func (c *Client) GetLoginData() (map[string]any, error)
func (c *Client) GetBookmarks(ctx context.Context) (map[string]any, error)
func (c *Client) GetHistoryData(ctx context.Context, flight *Flight, fileType string, timestamp int64) (string, error)
```

Where the other SDKs have a default argument, zero means that default:
`flightLimit` 100, `page` 1, `limit` 50. The full reference, generated from the
source, is on
[pkg.go.dev](https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi).
:::
::::

## Flights

| Python | Node.js | Go | Description |
|---|---|---|---|
| `get_flights` | `getFlights` | `GetFlights` | Flights of the live feed, optionally filtered. See [Live flights](flights.md). |
| `get_flight_details` | `getFlightDetails` | `GetFlightDetails` | Details payload of one flight. See [Flight details](flights.md#flight-details). |
| `get_flight_tracker_config` | `getFlightTrackerConfig` | `GetFlightTrackerConfig` | Copy of the current feed settings. See [Flight tracker settings](tracker-config.md). |
| `set_flight_tracker_config` | `setFlightTrackerConfig` | `SetFlightTrackerConfig` | Change the feed settings. See [Flight tracker settings](tracker-config.md). |

## Zones and bounds

These make no request.

| Python | Node.js | Go | Description |
|---|---|---|---|
| `get_zones` | `getZones` | `GetZones` | Major zones of the globe. See [Zones](zones.md#zones). |
| `get_bounds` | `getBounds` | `GetBounds` | Bounds string of a zone. See [Zones](zones.md#zones). |
| `get_bounds_by_point` | `getBoundsByPoint` | `GetBoundsByPoint` | Bounds string of the square around a point. See [Around a point](zones.md#around-a-point). |

## Airports

| Python | Node.js | Go | Description |
|---|---|---|---|
| `get_airport` | `getAirport` | `GetAirport` | One airport, by its IATA or ICAO code. See [Airports](airports.md#one-airport-by-code). |
| `get_airport_details` | `getAirportDetails` | `GetAirportDetails` | Details payload of one airport. See [Airport details](airports.md#the-raw-details-payload). |
| `get_airports` | `getAirports` | `GetAirports` | Airports of some countries, or all of them. See [Airports of a country](airports.md#airports-of-a-country). |
| `get_airport_disruptions` | `getAirportDisruptions` | `GetAirportDisruptions` | Current airport disruptions. See [Airport disruptions](live-data.md#airport-disruptions). |

## Airlines and images

| Python | Node.js | Go | Description |
|---|---|---|---|
| `get_airlines` | `getAirlines` | `GetAirlines` | Every airline. See [Airlines](airlines.md#listing-the-airlines). |
| `get_airline_logo` | `getAirlineLogo` | `GetAirlineLogo` | Logo of an airline. See [Airline logos](airlines.md#airline-logos). |
| `get_country_flag` | `getCountryFlag` | `GetCountryFlag` | Flag of a country. See [Country flags](airlines.md#country-flags). |

## More data

| Python | Node.js | Go | Description |
|---|---|---|---|
| `search` | `search` | `Search` | Search results, grouped by category. See [Search](searching.md). |
| `get_most_tracked` | `getMostTracked` | `GetMostTracked` | Most tracked flights. See [Most tracked flights](live-data.md#most-tracked-flights). |
| `get_volcanic_eruptions` | `getVolcanicEruptions` | `GetVolcanicEruptions` | Volcanic eruptions and ash clouds. See [Volcanic eruptions](live-data.md#volcanic-eruptions). |

## Account

| Python | Node.js | Go | Description |
|---|---|---|---|
| `login` | `login` | `Login` | Log in to a FlightRadar24 account. See [Logging in](account.md#logging-in). |
| `logout` | `logout` | `Logout` | End the session. See [Session state](account.md#session-state). |
| `is_logged_in` | `isLoggedIn` | `IsLoggedIn` | Whether the client holds a session. |
| `get_login_data` | `getLoginData` | `GetLoginData` | Data of the logged-in account. |
| `get_bookmarks` | `getBookmarks` | `GetBookmarks` | Bookmarks of the account. See [Bookmarks](account.md#bookmarks). |
| `get_history_data` | `getHistoryData` | `GetHistoryData` | Track of a flight, as CSV or KML. See [Flight history](account.md#flight-history). |

## What each package exports

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
from FlightRadarAPI import (
    FlightRadar24API,           # the client
    Flight, Airport, Entity,    # what the client returns
    Countries,                  # country names, for get_airports
    FlightTrackerConfig,        # settings of the flight feed
    RetryPolicy,                # retrying transient failures
    FlightRadarError, AirportNotFoundError, CloudflareError,
    DecompressionLimitError, LoginError,
)
```

Anything else in the package, such as the `parsers` and `request` modules, is
internal and may change without notice.
:::

:::{tab-item} Node.js
:sync: node

```javascript
const {
    FlightRadar24API,           // the client
    Flight, Airport, Entity,    // what the client returns
    Countries,                  // country names, for getAirports
    FlightTrackerConfig,        // settings of the flight feed
    RetryPolicy,                // retrying transient failures
    FlightRadarError, AirportNotFoundError, CloudflareError,
    DecompressionLimitError, LoginError,
    version, author,
} = require("flightradarapi");
```

The package also exports `APIClient`, the HTTP client `FlightRadar24API` is
built on. It is there for advanced cases; most programs never need it.
:::

:::{tab-item} Go
:sync: go

| Kind | Names |
|---|---|
| Client | `Client`, `New`, `Options`, `FlightSearch` |
| Results | `Flight`, `FlightDetails`, `Airport`, `Airline`, `Image`, `Zone`, `Entity`, `Positioned` |
| Building results | `NewFlight`, `NewAirport`, `NewAirportFromBasicInfo`, `NewAirportFromInfo`, `NewAirportFromDetails` |
| Countries | `Country`, the `Country...` constants, `AllCountries` |
| Flight feed settings | `FlightTrackerConfig`, `NewFlightTrackerConfig` |
| Retrying | `RetryPolicy`, `NewRetryPolicy`, `DefaultRetryBaseDelay`, `DefaultRetryMaxDelay`, `DefaultRetryJitter` |
| TLS | `TLSProfile`, `Chrome136Profile` |
| Errors | `ErrFlightRadar`, `ErrAirportNotFound`, `ErrCloudflare`, `ErrDecompressionLimit`, `ErrLogin`, and the types `AirportNotFoundError`, `CloudflareError`, `DecompressionLimitError`, `LoginError`, `StatusError` |
| Other | `SetLogger`, `Response`, `Version`, `Author`, `DefaultText`, `DefaultTimeout`, `MaxResponseBytes` |
:::
::::
