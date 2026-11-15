---
og:description: Unofficial SDK for FlightRadar24, for Python, Node.js and Go. Live flights, airports, airlines, zones and more, with the same features in every language.
myst:
  html_meta:
    description: "Unofficial SDK for FlightRadar24, for Python, Node.js and Go. Live flights, airports, airlines, zones and more, with the same features in every language."
---

# FlightRadarAPI

<p class="hero"><img alt="" src="_static/logo.svg"><span>FlightRadar<em>API</em></span></p>

## FlightRadarAPI Documentation
Unofficial SDK for [FlightRadar24](https://www.flightradar24.com/), for
**Python**, **Node.js** and **Go**. Live flights, airports, airlines, zones and
more.

This SDK should only be used for your own educational purposes. If you are interested in accessing Flightradar24 data commercially, please contact [business@fr24.com](mailto:business@fr24.com). See
[Flightradar24's terms and conditions](https://www.flightradar24.com/terms-and-conditions).

<table class="badge-table">
  <tr>
    <th>project</th>
    <td>
      <a href="https://flightradarapi.readthedocs.io/?badge=latest"><img alt="Documentation Status" src="https://readthedocs.org/projects/flightradarapi/badge/?version=latest"></a>
      <a href="https://github.com/JeanExtreme002/FlightRadarAPI/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/pypi/l/FlightRadarAPI"></a>
    </td>
  </tr>
  <tr>
    <th>tests</th>
    <td>
      <a href="https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/python-package.yml"><img alt="Python Package" src="https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/python-package.yml/badge.svg"></a>
      <a href="https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/node-package.yml"><img alt="Node.js Package" src="https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/node-package.yml/badge.svg"></a>
      <a href="https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/go-package.yml"><img alt="Go Package" src="https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/go-package.yml/badge.svg"></a>
    </td>
  </tr>
  <tr>
    <th>python</th>
    <td>
      <a href="https://pypi.org/project/FlightRadarAPI/"><img alt="PyPI version" src="https://img.shields.io/pypi/v/FlightRadarAPI?logo=pypi"></a>
      <a href="https://pypi.org/project/FlightRadarAPI/"><img alt="Python 3.10+" src="https://img.shields.io/badge/python-3.10+-8A2BE2"></a>
      <a href="https://pypi.org/project/FlightRadarAPI/"><img alt="Total downloads" src="https://static.pepy.tech/personalized-badge/flightradarapi?period=total&units=international_system&left_color=grey&right_color=orange&left_text=downloads%20(total)"></a>
      <a href="https://pypi.org/project/FlightRadarAPI/"><img alt="Monthly downloads" src="https://img.shields.io/pypi/dm/flightradarapi?style=flat&label=frequency"></a>
    </td>
  </tr>
  <tr>
    <th>node.js</th>
    <td>
      <a href="https://www.npmjs.com/package/flightradarapi"><img alt="npm version" src="https://img.shields.io/npm/v/flightradarapi?logo=npm&color=red"></a>
      <a href="https://www.npmjs.com/package/flightradarapi"><img alt="Node.js 18.17+" src="https://img.shields.io/badge/node-18.17+-339933"></a>
      <a href="https://www.npmjs.com/package/flightradarapi"><img alt="npm downloads in the last year" src="https://img.shields.io/npm/dy/flightradarapi?label=downloads%20(year)&amp;color=blue"></a>
      <a href="https://www.npmjs.com/package/flightradarapi"><img alt="npm monthly downloads" src="https://img.shields.io/npm/dm/flightradarapi?style=flat&amp;label=frequency"></a>
    </td>
  </tr>
  <tr>
    <th>go</th>
    <td>
      <a href="https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi"><img alt="Go Reference" src="https://pkg.go.dev/badge/github.com/JeanExtreme002/FlightRadarAPI/go.svg"></a>
      <a href="https://go.dev/dl/"><img alt="Go 1.26+" src="https://img.shields.io/badge/go-1.26+-00ADD8"></a>
    </td>
  </tr>
</table>

```{admonition} Info
:class: note
This is not an official FlightRadar24 API. You can access their official API [here](https://fr24api.flightradar24.com/).
```

## Getting Started

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```bash
pip install FlightRadarAPI
```

```python
from FlightRadarAPI import FlightRadar24API

fr_api = FlightRadar24API()

for flight in fr_api.get_flights(airline="UAE")[:5]:
    print(flight.callsign, flight.get_flight_level(), flight.get_ground_speed())
```
:::

:::{tab-item} Node.js
:sync: node

```bash
npm install flightradarapi
```

```javascript
const { FlightRadar24API } = require("flightradarapi");

async function main() {
    const frApi = new FlightRadar24API();

    const flights = await frApi.getFlights("UAE");

    for (const flight of flights.slice(0, 5)) {
        console.log(flight.callsign, flight.getFlightLevel(), flight.getGroundSpeed());
    }
}

main();
```
:::

:::{tab-item} Go
:sync: go

```bash
go get github.com/JeanExtreme002/FlightRadarAPI/go@latest
```

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

    flights, err := client.GetFlights(context.Background(), flightradarapi.FlightSearch{Airline: "UAE"})

    if err != nil {
        log.Fatal(err)
    }

    for _, flight := range flights[:min(5, len(flights))] {
        fmt.Println(flight.Callsign, flight.GetFlightLevel(), flight.GetGroundSpeed())
    }
}
```
:::
::::

New here? Start with [Installation](installation.md) and the
[Quick Start](quickstart.md).

```{toctree}
:caption: Getting Started
:hidden:

installation
quickstart
```

```{toctree}
:caption: Flights
:hidden:

flights
zones
tracker-config
distances
```

```{toctree}
:caption: Airports & Airlines
:hidden:

airports
airlines
```

```{toctree}
:caption: More Data
:hidden:

searching
live-data
```

```{toctree}
:caption: Account
:hidden:

account
```

```{toctree}
:caption: Client
:hidden:

client
errors
```

```{toctree}
:caption: API Reference
:hidden:

api
flight
airport
countries
```

```{toctree}
:caption: Project
:hidden:

projects
contributing
license
GitHub <https://github.com/JeanExtreme002/FlightRadarAPI>
PyPI <https://pypi.org/project/FlightRadarAPI/>
npm <https://www.npmjs.com/package/flightradarapi>
pkg.go.dev <https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi>
```
