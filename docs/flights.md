# Live Flights

The Real Time Flight Tracker is the feed behind the FlightRadar24 map. Each
entry becomes a `Flight`, with its position, altitude, speed and codes.

## Getting flights

Without arguments, the feed returns the flights of the whole globe, up to the
`limit` of the [flight tracker settings](tracker-config.md) (5000 by default).

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
flights = fr_api.get_flights()

for flight in flights[:10]:
    print(flight)   # <(B77W) A6-EBM - Altitude: 35000 - Ground Speed: 480 - Heading: 90>
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const flights = await frApi.getFlights();

for (const flight of flights.slice(0, 10)) {
    console.log(flight.callsign, flight.aircraftCode, flight.registration);
}
```
:::

:::{tab-item} Go
:sync: go

```go
flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{})

if err != nil {
    log.Fatal(err)
}

for _, flight := range flights[:min(10, len(flights))] {
    fmt.Println(flight)   // <(B77W) A6-EBM - Altitude: 35000 - Ground Speed: 480 - Heading: 90>
}
```
:::
::::

## Filtering

Four filters narrow the search, and they can be combined:

| Filter | Meaning | Example |
|---|---|---|
| airline | ICAO code of the airline | `"UAE"` |
| bounds | Area to look at, as a `"y1,y2,x1,x2"` string (see [Zones and bounds](zones.md)) | `"73,-12,-156,38"` |
| registration | Aircraft registration | `"A6-EBM"` |
| aircraft type | Aircraft model code | `"B77W"` |

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
zone = fr_api.get_zones()["northamerica"]
bounds = fr_api.get_bounds(zone)

emirates_flights = fr_api.get_flights(
    airline="UAE",
    aircraft_type="B77W",
    bounds=bounds,
)
```

The signature is
`get_flights(airline=None, bounds=None, registration=None, aircraft_type=None, *, details=False)`.
:::

:::{tab-item} Node.js
:sync: node

```javascript
const zone = frApi.getZones()["northamerica"];
const bounds = frApi.getBounds(zone);

// getFlights(airline, bounds, registration, aircraftType, details)
const emiratesFlights = await frApi.getFlights("UAE", bounds, null, "B77W");
```

The arguments are positional: pass `null` for the filters you do not use.
:::

:::{tab-item} Go
:sync: go

```go
bounds := client.GetBounds(client.GetZones()["northamerica"])

emiratesFlights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{
    Airline:      "UAE",
    AircraftType: "B77W",
    Bounds:       bounds,
})
```

`FlightSearch` has the fields `Airline`, `Bounds`, `Registration`,
`AircraftType` and `Details`. Leave out the ones you do not use.
:::
::::

More options, such as which data sources to include or how many flights to
return, live in the [flight tracker settings](tracker-config.md).

## Flight details

The feed carries the essentials only. The details of a flight (airline and
aircraft names, origin and destination airports, status, times, trail) come from
a second request, and are then attached to the flight.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
flight_details = fr_api.get_flight_details(flight)   # dict, as FR24 sends it
flight.set_flight_details(flight_details)

print("Flying to", flight.destination_airport_name)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const flightDetails = await frApi.getFlightDetails(flight);   // object, as FR24 sends it
flight.setFlightDetails(flightDetails);

console.log("Flying to", flight.destinationAirportName);
```
:::

:::{tab-item} Go
:sync: go

```go
details, err := client.GetFlightDetails(ctx, flight)   // map[string]any, as FR24 sends it

if err != nil {
    log.Fatal(err)
}

flight.SetFlightDetails(details)

fmt.Println("Flying to", flight.Details.DestinationAirportName)
```

In Go the detail values live in `flight.Details`, which is `nil` until
`SetFlightDetails` is called. `flight.Details.Raw` keeps the whole payload.
:::
::::

### Details for every flight at once

Ask for the details in the search itself and they are fetched for every flight
found, several requests at a time (8 by default, see
[Configuration](client.md#concurrency)).

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
flights = fr_api.get_flights(airline="GLO", details=True)

for flight in flights:
    print(flight.callsign, "→", flight.destination_airport_name)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const flights = await frApi.getFlights("GLO", null, null, null, true);

for (const flight of flights) {
    console.log(flight.callsign, "→", flight.destinationAirportName);
}
```
:::

:::{tab-item} Go
:sync: go

```go
flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{
    Airline: "GLO",
    Details: true,
})

for _, flight := range flights {
    fmt.Println(flight.Callsign, "→", flight.Details.DestinationAirportName)
}
```
:::
::::

```{note}
This makes one extra request per flight. Combine it with a filter: asking for
the details of thousands of flights is slow and likely to get you blocked.
```

## Formatted values

A flight can render its numbers with their units.

| Python | Node.js | Go | Example |
|---|---|---|---|
| `get_altitude()` | `getAltitude()` | `GetAltitude()` | `"35000 ft"` |
| `get_flight_level()` | `getFlightLevel()` | `GetFlightLevel()` | `"350 FL"` |
| `get_ground_speed()` | `getGroundSpeed()` | `GetGroundSpeed()` | `"480 kts"` |
| `get_heading()` | `getHeading()` | `GetHeading()` | `"90°"` |
| `get_vertical_speed()` | `getVerticalSpeed()` | `GetVerticalSpeed()` | `"-1280 fpm"` |

The flight level is shown from 10000 ft up; below that, `get_flight_level()`
returns the same as `get_altitude()`. Each of these returns `"N/A"` when the
feed did not send the value.

## Checking a flight against criteria

`check_info` tells whether a flight matches one or more values. A plain name
compares for equality; with the `min` or `max` prefix it compares numerically.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
flight.check_info(min_altitude=6700, max_altitude=13000, airline_icao="THY")   # True or False
```

The prefixes are `min_` and `max_`. A name the flight does not have is ignored.
:::

:::{tab-item} Node.js
:sync: node

```javascript
flight.checkInfo({ minAltitude: 6700, maxAltitude: 13000, airlineIcao: "THY" });   // true or false
```

The prefixes are `min` and `max`, followed by the attribute name in camelCase.
A name the flight does not have is ignored.
:::

:::{tab-item} Go
:sync: go

```go
matched, err := flight.CheckInfo(map[string]any{
    "min_altitude": 6700,
    "max_altitude": 13000,
    "airline_icao": "THY",
})
```

The keys are the snake_case names the Python SDK uses, with the prefixes `min_`
and `max_`. A name that exists nowhere is an error, instead of being ignored.
:::
::::

A handy way to filter a list you already have:

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
cruising = [flight for flight in flights if flight.check_info(min_altitude=30000)]
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const cruising = flights.filter((flight) => flight.checkInfo({ minAltitude: 30000 }));
```
:::

:::{tab-item} Go
:sync: go

```go
var cruising []*flightradarapi.Flight

for _, flight := range flights {
    if matched, _ := flight.CheckInfo(map[string]any{"min_altitude": 30000}); matched {
        cruising = append(cruising, flight)
    }
}
```
:::
::::

## See also

- [Flight reference](flight.md): every attribute of a flight.
- [Distances](distances.md): how far a flight is from an airport, or from another flight.
