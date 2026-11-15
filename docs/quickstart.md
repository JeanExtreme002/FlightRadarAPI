# Quick Start

Everything starts with a client. It needs no account and no API key: it reads
the same public data the FlightRadar24 website shows.

## Create a client

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
from FlightRadarAPI import FlightRadar24API

fr_api = FlightRadar24API()
```

Calls are blocking and return when the data has arrived.
:::

:::{tab-item} Node.js
:sync: node

```javascript
const { FlightRadar24API } = require("flightradarapi");

const frApi = new FlightRadar24API();
```

Every method that talks to FlightRadar24 returns a `Promise`. The examples use
`await`, so run them inside an `async` function.
:::

:::{tab-item} Go
:sync: go

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi"
)

func main() {
    ctx := context.Background()
    client := flightradarapi.New()

    // ...
}
```

Construction cannot fail. Every method that talks to FlightRadar24 takes a
`context.Context` and returns an `error` alongside its result.
:::
::::

The examples in the rest of this documentation assume the client above:
`fr_api` in Python, `frApi` in Node.js, and `client` with a `ctx` in Go.

## Fetch the basics

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
flights = fr_api.get_flights()                # list of Flight
airports = fr_api.get_airports(["brazil"])    # list of Airport
airlines = fr_api.get_airlines()              # list of dict
zones = fr_api.get_zones()                    # dict
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const flights = await frApi.getFlights();              // Array of Flight
const airports = await frApi.getAirports(["brazil"]);  // Array of Airport
const airlines = await frApi.getAirlines();            // Array of object
const zones = frApi.getZones();                        // object
```
:::

:::{tab-item} Go
:sync: go

```go
flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{})   // []*Flight
airports, err := client.GetAirports(ctx, []flightradarapi.Country{
    flightradarapi.CountryBrazil,
})                                                                     // []*Airport
airlines, err := client.GetAirlines(ctx)                               // []Airline
zones := client.GetZones()                                             // map[string]Zone
```
:::
::::

## Follow one flight

The live feed gives each flight its position, speed and codes. One more call
adds the details: airline and aircraft names, airports, times and trail.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
flight = fr_api.get_flights(airline="UAE")[0]

print(flight.callsign, flight.get_altitude(), flight.get_heading())

flight.set_flight_details(fr_api.get_flight_details(flight))

print("Flying to", flight.destination_airport_name)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const [flight] = await frApi.getFlights("UAE");

console.log(flight.callsign, flight.getAltitude(), flight.getHeading());

flight.setFlightDetails(await frApi.getFlightDetails(flight));

console.log("Flying to", flight.destinationAirportName);
```
:::

:::{tab-item} Go
:sync: go

```go
flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{Airline: "UAE"})

if err != nil {
    log.Fatal(err)
}

flight := flights[0]

fmt.Println(flight.Callsign, flight.GetAltitude(), flight.GetHeading())

details, err := client.GetFlightDetails(ctx, flight)

if err != nil {
    log.Fatal(err)
}

flight.SetFlightDetails(details)

fmt.Println("Flying to", flight.Details.DestinationAirportName)
```
:::
::::

## Where to go next

- [Live flights](flights.md): filtering, details and the helpers of a flight.
- [Zones and bounds](zones.md): looking at one region, or around one point.
- [Airports](airports.md): one airport, or the airports of whole countries.
- [Configuration](client.md): timeouts, concurrency and TLS impersonation.
- [Errors and retries](errors.md): what can fail and how to retry it.
