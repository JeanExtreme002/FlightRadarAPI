# Airport

An `Airport` is an [`Entity`](distances.md), so it has a position and can
measure its distance to a flight or to another airport.

How much an airport carries depends on the call that produced it. The columns
of the tables below say which:

| Column | Call |
|---|---|
| **List** | [Airports of a country](airports.md#airports-of-a-country): `get_airports` |
| **Code** | [One airport by code](airports.md#one-airport-by-code): `get_airport` |
| **Details** | [Airport details](airports.md#airport-details): `get_airport` with details, or `set_airport_details` |

The names follow the convention of each language. What Python calls
`country_code` is `countryCode` in Node.js and `CountryCode` in Go.

## Attributes

### Identity and location

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Attribute | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `name` | Name of the airport | ✓ | ✓ | ✓ |
| `icao` | ICAO code | ✓ | ✓ | ✓ |
| `iata` | IATA code | ✓ | ✓ | ✓ |
| `country` | Name of the country | ✓ | ✓ | ✓ |
| `latitude` | Latitude, in degrees | empty | ✓ | ✓ |
| `longitude` | Longitude, in degrees | empty | ✓ | ✓ |
| `altitude` | Elevation of the airport, in feet | empty | ✓ | ✓ |
| `country_code` | Code of the country |  | ✓ | ✓ |
| `city` | City of the airport |  | ✓ | ✓ |
| `country_id` | FlightRadar24 identifier of the country |  |  | ✓ |
:::

:::{tab-item} Node.js
:sync: node

| Property | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `name` | Name of the airport | ✓ | ✓ | ✓ |
| `icao` | ICAO code | ✓ | ✓ | ✓ |
| `iata` | IATA code | ✓ | ✓ | ✓ |
| `country` | Name of the country | ✓ | ✓ | ✓ |
| `latitude` | Latitude, in degrees | empty | ✓ | ✓ |
| `longitude` | Longitude, in degrees | empty | ✓ | ✓ |
| `altitude` | Elevation of the airport, in feet | empty | ✓ | ✓ |
| `countryCode` | Code of the country |  | ✓ | ✓ |
| `city` | City of the airport |  | ✓ | ✓ |
| `countryId` | FlightRadar24 identifier of the country |  |  | ✓ |
:::

:::{tab-item} Go
:sync: go

| Field | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `Name` | Name of the airport | ✓ | ✓ | ✓ |
| `ICAO` | ICAO code | ✓ | ✓ | ✓ |
| `IATA` | IATA code | ✓ | ✓ | ✓ |
| `Country` | Name of the country | ✓ | ✓ | ✓ |
| `Latitude` | Latitude, in degrees | empty | ✓ | ✓ |
| `Longitude` | Longitude, in degrees | empty | ✓ | ✓ |
| `Altitude` | Elevation of the airport, in feet | empty | ✓ | ✓ |
| `CountryCode` | Code of the country |  | ✓ | ✓ |
| `City` | City of the airport |  | ✓ | ✓ |
| `CountryID` | FlightRadar24 identifier of the country |  |  | ✓ |
:::

::::

### Timezone

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Attribute | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `timezone_name` | Name of the timezone, such as `"Asia/Kathmandu"` |  | ✓ | ✓ |
| `timezone_abbr` | Abbreviation of the timezone |  | ✓ | ✓ |
| `timezone_abbr_name` | Name the abbreviation stands for |  | ✓ | ✓ |
| `timezone_offset` | Offset from UTC, in seconds |  | ✓ | ✓ |
| `timezone_offset_hours` | Offset from UTC, as text in hours |  | ✓ | ✓ |
:::

:::{tab-item} Node.js
:sync: node

| Property | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `timezoneName` | Name of the timezone, such as `"Asia/Kathmandu"` |  | ✓ | ✓ |
| `timezoneAbbr` | Abbreviation of the timezone |  | ✓ | ✓ |
| `timezoneAbbrName` | Name the abbreviation stands for |  | ✓ | ✓ |
| `timezoneOffset` | Offset from UTC, in seconds |  | ✓ | ✓ |
| `timezoneOffsetHours` | Offset from UTC, as text in hours |  | ✓ | ✓ |
:::

:::{tab-item} Go
:sync: go

| Field | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `TimezoneName` | Name of the timezone, such as `"Asia/Kathmandu"` |  | ✓ | ✓ |
| `TimezoneAbbr` | Abbreviation of the timezone |  | ✓ | ✓ |
| `TimezoneAbbrName` | Name the abbreviation stands for |  | ✓ | ✓ |
| `TimezoneOffset` | Offset from UTC, in seconds |  | ✓ | ✓ |
| `TimezoneOffsetHours` | Offset from UTC, as text in hours |  | ✓ | ✓ |
:::

::::

### Links

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Attribute | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `website` | Website of the airport |  | ✓ | ✓ |
| `visible` | The `visible` flag FlightRadar24 sends for the airport |  | ✓ | ✓ |
| `wikipedia` | Wikipedia page of the airport |  |  | ✓ |
| `images` | Photos of the airport, as FlightRadar24 sends them |  |  | ✓ |
:::

:::{tab-item} Node.js
:sync: node

| Property | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `website` | Website of the airport |  | ✓ | ✓ |
| `visible` | The `visible` flag FlightRadar24 sends for the airport |  | ✓ | ✓ |
| `wikipedia` | Wikipedia page of the airport |  |  | ✓ |
| `images` | Photos of the airport, as FlightRadar24 sends them |  |  | ✓ |
:::

:::{tab-item} Go
:sync: go

| Field | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `Website` | Website of the airport |  | ✓ | ✓ |
| `Visible` | The `visible` flag FlightRadar24 sends for the airport |  | ✓ | ✓ |
| `Wikipedia` | Wikipedia page of the airport |  |  | ✓ |
| `Images` | Photos of the airport, as FlightRadar24 sends them |  |  | ✓ |
:::

::::

### Operations

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Attribute | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `runways` | Runways of the airport |  |  | ✓ |
| `weather` | Current weather at the airport |  |  | ✓ |
| `arrivals` | Arrivals of the airport schedule |  |  | ✓ |
| `departures` | Departures of the airport schedule |  |  | ✓ |
| `aircraft_on_ground` | Number of aircraft on the ground |  |  | ✓ |
| `aircraft_visible_on_ground` | Number of those FlightRadar24 can see |  |  | ✓ |
:::

:::{tab-item} Node.js
:sync: node

| Property | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `runways` | Runways of the airport |  |  | ✓ |
| `weather` | Current weather at the airport |  |  | ✓ |
| `arrivals` | Arrivals of the airport schedule |  |  | ✓ |
| `departures` | Departures of the airport schedule |  |  | ✓ |
| `aircraftOnGround` | Number of aircraft on the ground |  |  | ✓ |
| `aircraftVisibleOnGround` | Number of those FlightRadar24 can see |  |  | ✓ |
:::

:::{tab-item} Go
:sync: go

| Field | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `Runways` | Runways of the airport |  |  | ✓ |
| `Weather` | Current weather at the airport |  |  | ✓ |
| `Arrivals` | Arrivals of the airport schedule |  |  | ✓ |
| `Departures` | Departures of the airport schedule |  |  | ✓ |
| `AircraftOnGround` | Number of aircraft on the ground |  |  | ✓ |
| `AircraftVisibleOnGround` | Number of those FlightRadar24 can see |  |  | ✓ |
:::

::::

### Reviews

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Attribute | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `reviews_url` | Address of the reviews page on FlightRadar24 |  |  | ✓ |
| `reviews` | Number of reviews |  |  | ✓ |
| `evaluation` | Evaluation of the airport |  |  | ✓ |
| `average_rating` | Average rating |  |  | ✓ |
| `total_rating` | Number of ratings |  |  | ✓ |
:::

:::{tab-item} Node.js
:sync: node

| Property | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `reviewsUrl` | Address of the reviews page on FlightRadar24 |  |  | ✓ |
| `reviews` | Number of reviews |  |  | ✓ |
| `evaluation` | Evaluation of the airport |  |  | ✓ |
| `averageRating` | Average rating |  |  | ✓ |
| `totalRating` | Number of ratings |  |  | ✓ |
:::

:::{tab-item} Go
:sync: go

| Field | Description | List | Code | Details |
|---|---|:-:|:-:|:-:|
| `ReviewsURL` | Address of the reviews page on FlightRadar24 |  |  | ✓ |
| `Reviews` | Number of reviews |  |  | ✓ |
| `Evaluation` | Evaluation of the airport |  |  | ✓ |
| `AverageRating` | Average rating |  |  | ✓ |
| `TotalRating` | Number of ratings |  |  | ✓ |
:::

::::

`runways`, `weather`, `arrivals`, `departures` and `images` are kept as
FlightRadar24 sends them. How many flights the schedule lists is set by the
flight limit and the page of
[`get_airport_details`](airports.md#the-raw-details-payload).

## Missing values

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

An attribute whose column is blank **does not exist** on that airport: reading
it raises `AttributeError`. Use `getattr(airport, "city", None)` when the
airport may come from more than one call.

On a listed airport, `latitude`, `longitude` and `altitude` are `None`.

On the other two, a value FlightRadar24 left out is `None` or the string
`"N/A"`, depending on the attribute and on the call. The collections are empty
instead: `runways` is `[]`, and `weather`, `arrivals`,
`departures` and `images` are `{}`.
:::

:::{tab-item} Node.js
:sync: node

A property whose column is blank is `undefined` on that airport.

On a listed airport, `latitude`, `longitude` and `altitude` are `null`.

On the other two, a value FlightRadar24 left out is `null` or the string
`"N/A"`, depending on the property and on the call. The collections are empty
instead: `runways` is `[]`, and `weather`, `arrivals`,
`departures` and `images` are `{}`.
:::

:::{tab-item} Go
:sync: go

Every field exists on every airport. One that the call did not fill in, or that
FlightRadar24 left out, holds its zero value: `""` for text, `nil` for the
numbers and for `Visible`, which are pointers, and empty for the maps and
slices.

The numbers are `*float64`, `Visible` is `*bool`, `Runways` is `[]any`, and
`Weather`, `Arrivals`, `Departures` and `Images` are `map[string]any`.

`RawDetails` holds the payload the airport was built from, for what the struct
does not name. It is `nil` on a listed airport.
:::
::::

## Methods

| Python | Node.js | Go | Description |
|---|---|---|---|
| `set_airport_details(details)` | `setAirportDetails(details)` | `SetAirportDetails(details)` | Fill the airport in from a details payload |
| `get_distance_from(entity)` | `getDistanceFrom(entity)` | `GetDistanceFrom(other)` | Distance to another entity, in kilometers. See [Distances](distances.md). |

## Building an airport yourself

The client builds the airports it returns. There is one constructor for each of
the three payloads an airport can come from.

| Payload | Python | Node.js | Go |
|---|---|---|---|
| A row with `name`, `icao`, `iata`, `lat`, `lon`, `alt` and `country` | `Airport.from_basic_info(row)` | `Airport.fromBasicInfo(row)` | `NewAirportFromBasicInfo(row)` |
| The `details` block of an airport | `Airport.from_info(info)` | `Airport.fromInfo(info)` | `NewAirportFromInfo(info)` |
| A [details payload](airports.md#the-raw-details-payload) | `Airport.from_details(details)` | `Airport.fromDetails(details)` | `NewAirportFromDetails(details)` |

An empty airport, to be filled in later with `set_airport_details`, is
`Airport()` in Python, `new Airport()` in Node.js and `NewAirport()` in Go.
