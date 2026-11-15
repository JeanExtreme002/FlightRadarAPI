# Client Methods

The client is the entry point of each SDK: `FlightRadar24API` in Python and
Node.js, `Client` in Go. Its methods are the same in the three languages, apart
from the naming convention of each.

This page lists every one of them. The linked guides explain them with examples.
The Go package is also documented, from its source, on
[pkg.go.dev](https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi).

## Flights

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Method | Description |
|---|---|
| `get_flights` | Flights of the live feed, optionally filtered. See [Live flights](flights.md). |
| `get_flight_details` | Details payload of one flight. See [Flight details](flights.md#flight-details). |
| `get_flight_tracker_config` | Copy of the current feed settings. See [Flight tracker settings](tracker-config.md). |
| `set_flight_tracker_config` | Change the feed settings. See [Flight tracker settings](tracker-config.md). |
:::

:::{tab-item} Node.js
:sync: node

| Method | Description |
|---|---|
| `getFlights` | Flights of the live feed, optionally filtered. See [Live flights](flights.md). |
| `getFlightDetails` | Details payload of one flight. See [Flight details](flights.md#flight-details). |
| `getFlightTrackerConfig` | Copy of the current feed settings. See [Flight tracker settings](tracker-config.md). |
| `setFlightTrackerConfig` | Change the feed settings. See [Flight tracker settings](tracker-config.md). |
:::

:::{tab-item} Go
:sync: go

| Method | Description |
|---|---|
| `GetFlights` | Flights of the live feed, optionally filtered. See [Live flights](flights.md). |
| `GetFlightDetails` | Details payload of one flight. See [Flight details](flights.md#flight-details). |
| `GetFlightTrackerConfig` | Copy of the current feed settings. See [Flight tracker settings](tracker-config.md). |
| `SetFlightTrackerConfig` | Change the feed settings. See [Flight tracker settings](tracker-config.md). |
:::

::::

## Zones and bounds

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Method | Description |
|---|---|
| `get_zones` | Major zones of the globe. See [Zones](zones.md#zones). |
| `get_bounds` | Bounds string of a zone. See [Zones](zones.md#zones). |
| `get_bounds_by_point` | Bounds string of the square around a point. See [Around a point](zones.md#around-a-point). |
:::

:::{tab-item} Node.js
:sync: node

| Method | Description |
|---|---|
| `getZones` | Major zones of the globe. See [Zones](zones.md#zones). |
| `getBounds` | Bounds string of a zone. See [Zones](zones.md#zones). |
| `getBoundsByPoint` | Bounds string of the square around a point. See [Around a point](zones.md#around-a-point). |
:::

:::{tab-item} Go
:sync: go

| Method | Description |
|---|---|
| `GetZones` | Major zones of the globe. See [Zones](zones.md#zones). |
| `GetBounds` | Bounds string of a zone. See [Zones](zones.md#zones). |
| `GetBoundsByPoint` | Bounds string of the square around a point. See [Around a point](zones.md#around-a-point). |
:::

::::

## Airports

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Method | Description |
|---|---|
| `get_airport` | One airport, by its IATA or ICAO code. See [Airports](airports.md#one-airport-by-code). |
| `get_airport_details` | Details payload of one airport. See [Airport details](airports.md#the-raw-details-payload). |
| `get_airports` | Airports of some countries, or all of them. See [Airports of a country](airports.md#airports-of-a-country). |
| `get_airport_disruptions` | Current airport disruptions. See [Airport disruptions](live-data.md). |
:::

:::{tab-item} Node.js
:sync: node

| Method | Description |
|---|---|
| `getAirport` | One airport, by its IATA or ICAO code. See [Airports](airports.md#one-airport-by-code). |
| `getAirportDetails` | Details payload of one airport. See [Airport details](airports.md#the-raw-details-payload). |
| `getAirports` | Airports of some countries, or all of them. See [Airports of a country](airports.md#airports-of-a-country). |
| `getAirportDisruptions` | Current airport disruptions. See [Airport disruptions](live-data.md). |
:::

:::{tab-item} Go
:sync: go

| Method | Description |
|---|---|
| `GetAirport` | One airport, by its IATA or ICAO code. See [Airports](airports.md#one-airport-by-code). |
| `GetAirportDetails` | Details payload of one airport. See [Airport details](airports.md#the-raw-details-payload). |
| `GetAirports` | Airports of some countries, or all of them. See [Airports of a country](airports.md#airports-of-a-country). |
| `GetAirportDisruptions` | Current airport disruptions. See [Airport disruptions](live-data.md). |
:::

::::

## Airlines and images

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Method | Description |
|---|---|
| `get_airlines` | Every airline. See [Airlines](airlines.md#listing-the-airlines). |
| `get_airline_logo` | Logo of an airline. See [Airline logos](airlines.md#airline-logos). |
| `get_country_flag` | Flag of a country. See [Country flags](airlines.md#country-flags). |
:::

:::{tab-item} Node.js
:sync: node

| Method | Description |
|---|---|
| `getAirlines` | Every airline. See [Airlines](airlines.md#listing-the-airlines). |
| `getAirlineLogo` | Logo of an airline. See [Airline logos](airlines.md#airline-logos). |
| `getCountryFlag` | Flag of a country. See [Country flags](airlines.md#country-flags). |
:::

:::{tab-item} Go
:sync: go

| Method | Description |
|---|---|
| `GetAirlines` | Every airline. See [Airlines](airlines.md#listing-the-airlines). |
| `GetAirlineLogo` | Logo of an airline. See [Airline logos](airlines.md#airline-logos). |
| `GetCountryFlag` | Flag of a country. See [Country flags](airlines.md#country-flags). |
:::

::::

## More data

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Method | Description |
|---|---|
| `search` | Search results, grouped by category. See [Search](searching.md). |
| `get_most_tracked` | Most tracked flights. See [Most tracked flights](live-data.md). |
| `get_volcanic_eruptions` | Volcanic eruptions and ash clouds. See [Volcanic eruptions](live-data.md). |
:::

:::{tab-item} Node.js
:sync: node

| Method | Description |
|---|---|
| `search` | Search results, grouped by category. See [Search](searching.md). |
| `getMostTracked` | Most tracked flights. See [Most tracked flights](live-data.md). |
| `getVolcanicEruptions` | Volcanic eruptions and ash clouds. See [Volcanic eruptions](live-data.md). |
:::

:::{tab-item} Go
:sync: go

| Method | Description |
|---|---|
| `Search` | Search results, grouped by category. See [Search](searching.md). |
| `GetMostTracked` | Most tracked flights. See [Most tracked flights](live-data.md). |
| `GetVolcanicEruptions` | Volcanic eruptions and ash clouds. See [Volcanic eruptions](live-data.md). |
:::

::::

## Account

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Method | Description |
|---|---|
| `login` | Log in to a FlightRadar24 account. See [Logging in](account.md#logging-in). |
| `logout` | End the session. See [Session state](account.md#session-state). |
| `is_logged_in` | Whether the client holds a session. |
| `get_login_data` | Data of the logged-in account. |
| `get_bookmarks` | Bookmarks of the account. See [Bookmarks](account.md#bookmarks). |
| `get_history_data` | Track of a flight, as CSV or KML. See [Flight history](account.md#flight-history). |
:::

:::{tab-item} Node.js
:sync: node

| Method | Description |
|---|---|
| `login` | Log in to a FlightRadar24 account. See [Logging in](account.md#logging-in). |
| `logout` | End the session. See [Session state](account.md#session-state). |
| `isLoggedIn` | Whether the client holds a session. |
| `getLoginData` | Data of the logged-in account. |
| `getBookmarks` | Bookmarks of the account. See [Bookmarks](account.md#bookmarks). |
| `getHistoryData` | Track of a flight, as CSV or KML. See [Flight history](account.md#flight-history). |
:::

:::{tab-item} Go
:sync: go

| Method | Description |
|---|---|
| `Login` | Log in to a FlightRadar24 account. See [Logging in](account.md#logging-in). |
| `Logout` | End the session. See [Session state](account.md#session-state). |
| `IsLoggedIn` | Whether the client holds a session. |
| `GetLoginData` | Data of the logged-in account. |
| `GetBookmarks` | Bookmarks of the account. See [Bookmarks](account.md#bookmarks). |
| `GetHistoryData` | Track of a flight, as CSV or KML. See [Flight history](account.md#flight-history). |
:::

::::
