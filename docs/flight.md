# Flight

A `Flight` is one aircraft of the live feed. It is an [`Entity`](distances.md),
so it has a position and can measure its distance to an airport or to another
flight.

Its attributes come in two groups: the ones the feed sends for every flight, and
the ones added by the [flight details](flights.md#flight-details).

## Attributes from the feed

Present on every flight.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Attribute | Description |
|---|---|
| `id` | Identifier of the flight in FlightRadar24 |
| `latitude` | Latitude, in degrees |
| `longitude` | Longitude, in degrees |
| `altitude` | Altitude, in feet |
| `heading` | Heading, in degrees |
| `ground_speed` | Ground speed, in knots |
| `vertical_speed` | Vertical speed, in feet per minute |
| `on_ground` | `1` when the aircraft is on the ground, `0` otherwise |
| `time` | Time of the position, as a Unix timestamp |
| `callsign` | Callsign of the flight |
| `number` | Flight number, such as `"EK202"` |
| `squawk` | Transponder code |
| `icao_24bit` | ICAO 24-bit address of the aircraft, in hexadecimal |
| `registration` | Registration of the aircraft |
| `aircraft_code` | Model code of the aircraft, such as `"B77W"` |
| `airline_icao` | ICAO code of the airline |
| `airline_iata` | IATA code of the airline, taken from the first two characters of the flight number |
| `origin_airport_iata` | IATA code of the origin airport |
| `destination_airport_iata` | IATA code of the destination airport |
:::

:::{tab-item} Node.js
:sync: node

| Property | Description |
|---|---|
| `id` | Identifier of the flight in FlightRadar24 |
| `latitude` | Latitude, in degrees |
| `longitude` | Longitude, in degrees |
| `altitude` | Altitude, in feet |
| `heading` | Heading, in degrees |
| `groundSpeed` | Ground speed, in knots |
| `verticalSpeed` | Vertical speed, in feet per minute |
| `onGround` | `1` when the aircraft is on the ground, `0` otherwise |
| `time` | Time of the position, as a Unix timestamp |
| `callsign` | Callsign of the flight |
| `number` | Flight number, such as `"EK202"` |
| `squawk` | Transponder code |
| `icao24bit` | ICAO 24-bit address of the aircraft, in hexadecimal |
| `registration` | Registration of the aircraft |
| `aircraftCode` | Model code of the aircraft, such as `"B77W"` |
| `airlineIcao` | ICAO code of the airline |
| `airlineIata` | IATA code of the airline, taken from the first two characters of the flight number |
| `originAirportIata` | IATA code of the origin airport |
| `destinationAirportIata` | IATA code of the destination airport |
:::

:::{tab-item} Go
:sync: go

| Field | Description |
|---|---|
| `ID` | Identifier of the flight in FlightRadar24 |
| `Latitude` | Latitude, in degrees |
| `Longitude` | Longitude, in degrees |
| `Altitude` | Altitude, in feet |
| `Heading` | Heading, in degrees |
| `GroundSpeed` | Ground speed, in knots |
| `VerticalSpeed` | Vertical speed, in feet per minute |
| `OnGround` | `1` when the aircraft is on the ground, `0` otherwise |
| `Time` | Time of the position, as a Unix timestamp |
| `Callsign` | Callsign of the flight |
| `Number` | Flight number, such as `"EK202"` |
| `Squawk` | Transponder code |
| `ICAO24Bit` | ICAO 24-bit address of the aircraft, in hexadecimal |
| `Registration` | Registration of the aircraft |
| `AircraftCode` | Model code of the aircraft, such as `"B77W"` |
| `AirlineICAO` | ICAO code of the airline |
| `AirlineIATA` | IATA code of the airline, taken from the first two characters of the flight number |
| `OriginAirportIATA` | IATA code of the origin airport |
| `DestinationAirportIATA` | IATA code of the destination airport |
:::

::::

## Attributes from the details

Present after `set_flight_details` is called, or when the flights were searched
with details.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

The attributes below are set on the flight itself, next to the ones from the
feed. They do not exist before `set_flight_details` is called.
:::

:::{tab-item} Node.js
:sync: node

The properties below are set on the flight itself, next to the ones from the
feed. They are `undefined` before `setFlightDetails` is called.
:::

:::{tab-item} Go
:sync: go

The fields below belong to `FlightDetails`, reached through `flight.Details`:
`flight.Details.AirlineName`. `flight.Details` is `nil` before
`SetFlightDetails` is called.

`FlightDetails` also has `Raw`, the whole details payload, for what the struct
does not name.
:::
::::

### Aircraft and airline

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Attribute | Description |
|---|---|
| `aircraft_model` | Model of the aircraft, as text |
| `aircraft_age` | Age of the aircraft |
| `aircraft_country_id` | FlightRadar24 identifier of the country of the aircraft |
| `aircraft_images` | Photos of the aircraft, as FlightRadar24 sends them |
| `aircraft_history` | Previous flights of the aircraft |
| `airline_name` | Name of the airline |
| `airline_short_name` | Short name of the airline |
:::

:::{tab-item} Node.js
:sync: node

| Property | Description |
|---|---|
| `aircraftModel` | Model of the aircraft, as text |
| `aircraftAge` | Age of the aircraft |
| `aircraftCountryId` | FlightRadar24 identifier of the country of the aircraft |
| `aircraftImages` | Photos of the aircraft, as FlightRadar24 sends them |
| `aircraftHistory` | Previous flights of the aircraft |
| `airlineName` | Name of the airline |
| `airlineShortName` | Short name of the airline |
:::

:::{tab-item} Go
:sync: go

| Field | Description |
|---|---|
| `AircraftModel` | Model of the aircraft, as text |
| `AircraftAge` | Age of the aircraft |
| `AircraftCountryID` | FlightRadar24 identifier of the country of the aircraft |
| `AircraftImages` | Photos of the aircraft, as FlightRadar24 sends them |
| `AircraftHistory` | Previous flights of the aircraft |
| `AirlineName` | Name of the airline |
| `AirlineShortName` | Short name of the airline |
:::

::::

### Destination and origin airports

Each attribute below exists twice: once for the destination and once for the
origin. Replace `destination` with `origin` for the second set:
`origin_airport_name`, `originAirportName`, `OriginAirportName`.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Attribute | Description |
|---|---|
| `destination_airport_name` | Name of the airport |
| `destination_airport_icao` | ICAO code |
| `destination_airport_latitude` | Latitude, in degrees |
| `destination_airport_longitude` | Longitude, in degrees |
| `destination_airport_altitude` | Altitude of the airport |
| `destination_airport_country_name` | Name of the country |
| `destination_airport_country_code` | Code of the country |
| `destination_airport_terminal` | Terminal of the flight |
| `destination_airport_gate` | Gate of the flight |
| `destination_airport_baggage` | Baggage claim of the flight |
| `destination_airport_timezone_name` | Name of the timezone, such as `"America/New_York"` |
| `destination_airport_timezone_abbr` | Abbreviation of the timezone |
| `destination_airport_timezone_abbr_name` | Name the abbreviation stands for |
| `destination_airport_timezone_offset` | Offset from UTC, in seconds |
| `destination_airport_timezone_offset_hours` | Offset from UTC, as text in hours |
| `destination_airport_visible` | The `visible` flag FlightRadar24 sends for the airport |
| `destination_airport_website` | Website of the airport |
:::

:::{tab-item} Node.js
:sync: node

| Property | Description |
|---|---|
| `destinationAirportName` | Name of the airport |
| `destinationAirportIcao` | ICAO code |
| `destinationAirportLatitude` | Latitude, in degrees |
| `destinationAirportLongitude` | Longitude, in degrees |
| `destinationAirportAltitude` | Altitude of the airport |
| `destinationAirportCountryName` | Name of the country |
| `destinationAirportCountryCode` | Code of the country |
| `destinationAirportTerminal` | Terminal of the flight |
| `destinationAirportGate` | Gate of the flight |
| `destinationAirportBaggage` | Baggage claim of the flight |
| `destinationAirportTimezoneName` | Name of the timezone, such as `"America/New_York"` |
| `destinationAirportTimezoneAbbr` | Abbreviation of the timezone |
| `destinationAirportTimezoneAbbrName` | Name the abbreviation stands for |
| `destinationAirportTimezoneOffset` | Offset from UTC, in seconds |
| `destinationAirportTimezoneOffsetHours` | Offset from UTC, as text in hours |
| `destinationAirportVisible` | The `visible` flag FlightRadar24 sends for the airport |
| `destinationAirportWebsite` | Website of the airport |
:::

:::{tab-item} Go
:sync: go

| Field | Description |
|---|---|
| `DestinationAirportName` | Name of the airport |
| `DestinationAirportICAO` | ICAO code |
| `DestinationAirportLatitude` | Latitude, in degrees |
| `DestinationAirportLongitude` | Longitude, in degrees |
| `DestinationAirportAltitude` | Altitude of the airport |
| `DestinationAirportCountryName` | Name of the country |
| `DestinationAirportCountryCode` | Code of the country |
| `DestinationAirportTerminal` | Terminal of the flight |
| `DestinationAirportGate` | Gate of the flight |
| `DestinationAirportBaggage` | Baggage claim of the flight |
| `DestinationAirportTimezoneName` | Name of the timezone, such as `"America/New_York"` |
| `DestinationAirportTimezoneAbbr` | Abbreviation of the timezone |
| `DestinationAirportTimezoneAbbrName` | Name the abbreviation stands for |
| `DestinationAirportTimezoneOffset` | Offset from UTC, in seconds |
| `DestinationAirportTimezoneOffsetHours` | Offset from UTC, as text in hours |
| `DestinationAirportVisible` | The `visible` flag FlightRadar24 sends for the airport |
| `DestinationAirportWebsite` | Website of the airport |
:::

::::

The IATA codes of both airports come with the feed: see
`origin_airport_iata` and `destination_airport_iata` above.

### Status, times and trail

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Attribute | Description |
|---|---|
| `status_text` | Status of the flight, as text |
| `status_icon` | Name of the status icon FlightRadar24 shows |
| `time_details` | Scheduled, estimated and real times of the flight, as FlightRadar24 sends them |
| `trail` | Positions the flight has been through |
:::

:::{tab-item} Node.js
:sync: node

| Property | Description |
|---|---|
| `statusText` | Status of the flight, as text |
| `statusIcon` | Name of the status icon FlightRadar24 shows |
| `timeDetails` | Scheduled, estimated and real times of the flight, as FlightRadar24 sends them |
| `trail` | Positions the flight has been through |
:::

:::{tab-item} Go
:sync: go

| Field | Description |
|---|---|
| `StatusText` | Status of the flight, as text |
| `StatusIcon` | Name of the status icon FlightRadar24 shows |
| `TimeDetails` | Scheduled, estimated and real times of the flight, as FlightRadar24 sends them |
| `Trail` | Positions the flight has been through |
:::

::::

## Missing values

FlightRadar24 does not send every value for every flight.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

A value FlightRadar24 left out is the string `"N/A"`. The collections are empty
instead: `aircraft_history`, `aircraft_images` and `trail` are `[]`, and
`time_details` is `{}`.

Because of that, a numeric attribute is either a number or `"N/A"`. Check before
doing arithmetic:

```python
if isinstance(flight.altitude, (int, float)):
    print(flight.altitude * 0.3048, "m")
```
:::

:::{tab-item} Node.js
:sync: node

A value FlightRadar24 left out is the string `"N/A"`. The collections are empty
instead: `aircraftHistory`, `aircraftImages` and `trail` are `[]`, and
`timeDetails` is `{}`.

Because of that, a numeric property is either a number or `"N/A"`. Check before
doing arithmetic:

```javascript
if (typeof flight.altitude === "number") {
    console.log(flight.altitude * 0.3048, "m");
}
```
:::

:::{tab-item} Go
:sync: go

A value FlightRadar24 left out is the zero value of its field: `""` for text
and `nil` for the numbers and booleans, which are pointers.

```go
if flight.Altitude != nil {
    fmt.Println(*flight.Altitude*0.3048, "m")
}
```

The numbers are `*float64`, except `Time`, which is `*int64`. The `...Visible`
fields are `*bool`. `DefaultText` holds the `"N/A"` the formatting methods
return.
:::
::::

## Methods

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Method | Description |
|---|---|
| `get_altitude()` | Altitude with its unit. See [Formatted values](flights.md#formatted-values). |
| `get_flight_level()` | Flight level with its unit |
| `get_ground_speed()` | Ground speed with its unit |
| `get_heading()` | Heading with its unit |
| `get_vertical_speed()` | Vertical speed with its unit |
| `check_info(**info)` | Whether the flight matches some values. See [Checking a flight](flights.md#checking-a-flight-against-criteria). |
| `set_flight_details(details)` | Attach a details payload to the flight |
| `get_distance_from(entity)` | Distance to another entity, in kilometers. See [Distances](distances.md). |
:::

:::{tab-item} Node.js
:sync: node

| Method | Description |
|---|---|
| `getAltitude()` | Altitude with its unit. See [Formatted values](flights.md#formatted-values). |
| `getFlightLevel()` | Flight level with its unit |
| `getGroundSpeed()` | Ground speed with its unit |
| `getHeading()` | Heading with its unit |
| `getVerticalSpeed()` | Vertical speed with its unit |
| `checkInfo(info)` | Whether the flight matches some values. See [Checking a flight](flights.md#checking-a-flight-against-criteria). |
| `setFlightDetails(details)` | Attach a details payload to the flight |
| `getDistanceFrom(entity)` | Distance to another entity, in kilometers. See [Distances](distances.md). |
:::

:::{tab-item} Go
:sync: go

| Method | Description |
|---|---|
| `GetAltitude()` | Altitude with its unit. See [Formatted values](flights.md#formatted-values). |
| `GetFlightLevel()` | Flight level with its unit |
| `GetGroundSpeed()` | Ground speed with its unit |
| `GetHeading()` | Heading with its unit |
| `GetVerticalSpeed()` | Vertical speed with its unit |
| `CheckInfo(criteria)` | Whether the flight matches some values. See [Checking a flight](flights.md#checking-a-flight-against-criteria). |
| `SetFlightDetails(details)` | Attach a details payload to the flight |
| `GetDistanceFrom(other)` | Distance to another entity, in kilometers. See [Distances](distances.md). |
:::

::::
