# Airports

There are three ways to reach airports, and each returns a different amount of
information:

| Call | Requests | What the airport carries |
|---|---|---|
| [One airport by code](#one-airport-by-code) | 1 | Name, codes, position, altitude, country, city, timezone |
| [One airport, with details](#airport-details) | 1 | All of the above, plus runways, weather, schedule, ratings and more |
| [Airports of a country](#airports-of-a-country) | 1 or more per country | Name, codes and country only |

The [Airport reference](airport.md) lists every attribute and where it comes
from.

## One airport by code

Airports are looked up by their IATA code (3 letters) or ICAO code (4 letters).

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
airport = fr_api.get_airport("VNLK")

print(airport.name, airport.city, airport.country)
print(airport.latitude, airport.longitude, airport.altitude)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const airport = await frApi.getAirport("VNLK");

console.log(airport.name, airport.city, airport.country);
console.log(airport.latitude, airport.longitude, airport.altitude);
```
:::

:::{tab-item} Go
:sync: go

```go
airport, err := client.GetAirport(ctx, "VNLK", false)

if errors.Is(err, flightradarapi.ErrAirportNotFound) {
    fmt.Println("no such airport")
    return
}
if err != nil {
    log.Fatal(err)
}

fmt.Println(airport.Name, airport.City, airport.Country)
fmt.Println(*airport.Latitude, *airport.Longitude, *airport.Altitude)
```

`Latitude`, `Longitude` and `Altitude` are pointers, `nil` when FlightRadar24
sent no value.
:::
::::

A code that no airport answers to fails with `AirportNotFoundError`
(`ErrAirportNotFound` in Go). A code that is not 3 or 4 characters long is
rejected before any request is made. See [Errors and retries](errors.md).

## Airport details

Ask for the details to get the whole picture of an airport in one object.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
airport = fr_api.get_airport("VNLK", details=True)

print(airport.timezone_name, airport.website)
print(len(airport.runways), "runways")
print(airport.weather)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const airport = await frApi.getAirport("VNLK", true);

console.log(airport.timezoneName, airport.website);
console.log(airport.runways.length, "runways");
console.log(airport.weather);
```
:::

:::{tab-item} Go
:sync: go

```go
airport, err := client.GetAirport(ctx, "VNLK", true)

if err != nil {
    log.Fatal(err)
}

fmt.Println(airport.TimezoneName, airport.Website)
fmt.Println(len(airport.Runways), "runways")
fmt.Println(airport.Weather)
```
:::
::::

### The raw details payload

`get_airport_details` returns the payload itself, as FlightRadar24 sends it. It
takes two more parameters, which control the arrivals and departures of the
airport schedule:

| Parameter | Default | Meaning |
|---|---|---|
| flight limit | 100 | Number of flights listed in the schedule. The maximum is 100. |
| page | 1 | Page of the schedule, to go past the first 100 flights. |

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
details = fr_api.get_airport_details("KJFK", flight_limit=50, page=2)

arrivals = details["airport"]["pluginData"]["schedule"]["arrivals"]
```

The payload can be turned into an `Airport` at any time:

```python
from FlightRadarAPI import Airport

airport = Airport.from_details(details)

# Or, on an airport you already have
airport.set_airport_details(details)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const details = await frApi.getAirportDetails("KJFK", 50, 2);

const arrivals = details["airport"]["pluginData"]["schedule"]["arrivals"];
```

The payload can be turned into an `Airport` at any time:

```javascript
const { Airport } = require("flightradarapi");

const airport = Airport.fromDetails(details);

// Or, on an airport you already have
airport.setAirportDetails(details);
```
:::

:::{tab-item} Go
:sync: go

```go
details, err := client.GetAirportDetails(ctx, "KJFK", 50, 2)
```

Zero means the default: `GetAirportDetails(ctx, "KJFK", 0, 0)` asks for 100
flights of the first page.

The payload can be turned into an `Airport` at any time:

```go
airport := flightradarapi.NewAirportFromDetails(details)

// Or, on an airport you already have
airport.SetAirportDetails(details)
```

`airport.RawDetails` keeps the payload the airport was built from, for the
fields the struct does not name.
:::
::::

A flight limit above 100 is refused by FlightRadar24, and the SDK reports its
message: as a `ValueError` in Python, a `RangeError` in Node.js and an error in
Go.

## Airports of a country

`get_airports` lists the airports of one or more countries, or of the whole
world.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
from FlightRadarAPI import Countries

airports = fr_api.get_airports([Countries.BRAZIL, Countries.UNITED_STATES])

# A single country needs no list
airports = fr_api.get_airports(Countries.BRAZIL)

# Every airport
all_airports = fr_api.get_airports()
```

Countries can also be given by name or by slug: `"United States"` and
`"united-states"` are the same as `Countries.UNITED_STATES`. Any iterable is
accepted.
:::

:::{tab-item} Node.js
:sync: node

```javascript
const { Countries } = require("flightradarapi");

let airports = await frApi.getAirports([Countries.BRAZIL, Countries.UNITED_STATES]);

// A single country needs no array
airports = await frApi.getAirports(Countries.BRAZIL);

// Every airport
const allAirports = await frApi.getAirports();
```

Countries can also be given by name or by slug: `"United States"` and
`"united-states"` are the same as `Countries.UNITED_STATES`. Any iterable is
accepted.
:::

:::{tab-item} Go
:sync: go

```go
airports, err := client.GetAirports(ctx, []flightradarapi.Country{
    flightradarapi.CountryBrazil,
    flightradarapi.CountryUnitedStates,
})

// Every airport
allAirports, err := client.GetAirports(ctx, nil)
```

Countries can also be given by name or by slug:
`flightradarapi.Country("United States")` and
`flightradarapi.Country("united-states")` are the same as `CountryUnitedStates`.
`AllCountries()` enumerates the constants.
:::
::::

See [Countries](countries.md) for how countries are named.

## See also

- [Airport reference](airport.md): every attribute of an airport.
- [Airport disruptions](live-data.md): delays and cancellations by airport.
- [Distances](distances.md): how far an airport is from a flight, or from another airport.
