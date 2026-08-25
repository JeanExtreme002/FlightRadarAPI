# FlightRadarAPI
Unofficial SDK for [FlightRadar24](https://www.flightradar24.com/) for Go.

This SDK should only be used for your own educational purposes. If you are interested in accessing Flightradar24 data commercially, please contact business@fr24.com. See more information at [Flightradar24's terms and conditions](https://www.flightradar24.com/terms-and-conditions).

**Official FR24 API**: https://fr24api.flightradar24.com/

[![Go Package](https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/go-package.yml/badge.svg)](https://github.com/JeanExtreme002/FlightRadarAPI/actions)
[![License](https://img.shields.io/pypi/l/FlightRadarAPI)](https://github.com/JeanExtreme002/FlightRadarAPI)
[![Pypi](https://img.shields.io/pypi/v/FlightRadarAPI?logo=pypi)](https://pypi.org/project/FlightRadarAPI/)
[![Python Version](https://img.shields.io/badge/python-3.10+-8A2BE2)](https://pypi.org/project/FlightRadarAPI/)
[![Npm](https://img.shields.io/npm/v/flightradarapi?logo=npm&color=red)](https://www.npmjs.com/package/flightradarapi)
[![Node Version](https://img.shields.io/badge/node-18.17+-339933)](https://www.npmjs.com/package/flightradarapi)
[![Go Reference](https://pkg.go.dev/badge/github.com/JeanExtreme002/FlightRadarAPI/go.svg)](https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi)
[![Go Version](https://img.shields.io/badge/go-1.25+-00ADD8)](https://go.dev/dl/)
[![Downloads](https://static.pepy.tech/personalized-badge/flightradarapi?period=total&units=international_system&left_color=grey&right_color=orange&left_text=downloads)](https://pypi.org/project/FlightRadarAPI/)
[![Frequency](https://img.shields.io/pypi/dm/flightradarapi?style=flat&label=frequency)](https://pypi.org/project/FlightRadarAPI/)

## Installing FlightRadarAPI:
```
$ go get github.com/JeanExtreme002/FlightRadarAPI/go
```

## Basic Usage:
Import the package and create a client. Every method that talks to FlightRadar24 takes a `context.Context` and returns an `error` alongside its result.
```go
import "github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi"

client := flightradarapi.New()
```

**Getting flights list:**
```go
flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{})  // Returns a list of Flight objects
```

**Getting airports list:**
```go
// Get airports from specific countries
airports, err := client.GetAirports(ctx, []flightradarapi.Country{
    flightradarapi.CountryBrazil, flightradarapi.CountryUnitedStates,
})

// Pass nil to get every airport
allAirports, err := client.GetAirports(ctx, nil)
```

**Getting airlines list:**
```go
airlines, err := client.GetAirlines(ctx)  // Returns detailed airline information with IATA/ICAO codes
```

**Getting zones list:**
```go
zones := client.GetZones()
```

**Using the Country constants:**
```go
// Available countries, the counterpart of the Countries enum in the other packages
flightradarapi.CountryUnitedStates  // "united-states"
flightradarapi.CountryBrazil        // "brazil"
flightradarapi.CountryGermany       // "germany"
flightradarapi.CountryFrance        // "france"
// ... and many more

// AllCountries() enumerates them all
for _, country := range flightradarapi.AllCountries() { }
```

## Documentation
Explore the documentation of FlightRadarAPI package through [this site](https://JeanExtreme002.github.io/FlightRadarAPI/), or read the [Go reference](https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi).
