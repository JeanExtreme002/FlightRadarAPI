# FlightRadarAPI
Unofficial SDK for [FlightRadar24](https://www.flightradar24.com/) for Node.js.

This SDK should only be used for your own educational purposes. If you are interested in accessing Flightradar24 data commercially, please contact business@fr24.com. See more information at [Flightradar24's terms and conditions](https://www.flightradar24.com/terms-and-conditions).

**Official FR24 API**: https://fr24api.flightradar24.com/

[![Documentation Status](https://readthedocs.org/projects/flightradarapi/badge/?version=latest)](https://flightradarapi.readthedocs.io/?badge=latest)
[![Node.js Package](https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/node-package.yml/badge.svg)](https://github.com/JeanExtreme002/FlightRadarAPI/actions)
[![License](https://img.shields.io/pypi/l/FlightRadarAPI)](https://github.com/JeanExtreme002/FlightRadarAPI)
[![Pypi](https://img.shields.io/pypi/v/FlightRadarAPI?logo=pypi)](https://pypi.org/project/FlightRadarAPI/)
[![Python Version](https://img.shields.io/badge/python-3.10+-8A2BE2)](https://pypi.org/project/FlightRadarAPI/)
[![Npm](https://img.shields.io/npm/v/flightradarapi?logo=npm&color=red)](https://www.npmjs.com/package/flightradarapi)
[![Node Version](https://img.shields.io/badge/node-18.17+-339933)](https://www.npmjs.com/package/flightradarapi)
[![Go Reference](https://pkg.go.dev/badge/github.com/JeanExtreme002/FlightRadarAPI/go.svg)](https://pkg.go.dev/github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi)
[![Go Version](https://img.shields.io/badge/go-1.26+-00ADD8)](https://go.dev/dl/)
[![Npm Downloads](https://img.shields.io/npm/dy/flightradarapi?label=downloads%20&color=orange)](https://www.npmjs.com/package/flightradarapi)
[![Npm Frequency](https://img.shields.io/npm/dm/flightradarapi?style=flat&label=frequency)](https://www.npmjs.com/package/flightradarapi)

## Installing FlightRadarAPI:
```
$ npm install flightradarapi
```

## Basic Usage:

Import the class `FlightRadar24API` and create an instance of it.
```javascript
const { FlightRadar24API, Countries } = require("flightradarapi");
const frApi = new FlightRadar24API();
```

**Getting flights list:**
```javascript
let flights = await frApi.getFlights(...);  // Returns a list of Flight objects
```

**Getting airports list:**
```javascript
// Get airports from specific countries
let airports = await frApi.getAirports([Countries.BRAZIL, Countries.UNITED_STATES]);  // Returns a list of Airport objects

// Omit the countries to get every airport
let allAirports = await frApi.getAirports();
```

**Getting airlines list:**
```javascript
let airlines = await frApi.getAirlines();  // Returns detailed airline information with IATA/ICAO codes
```

**Getting zones list:**
```javascript
let zones = await frApi.getZones();
```

**Using Countries enum:**
```javascript
// Available countries in the Countries enum
const { Countries } = require("flightradarapi");

// Examples of country codes:
Countries.UNITED_STATES    // "united-states"
Countries.BRAZIL           // "brazil" 
Countries.GERMANY          // "germany"
Countries.FRANCE           // "france"
// ... and many more
```

## Documentation
Explore the documentation of FlightRadarAPI package through [this site](https://flightradarapi.readthedocs.io/).
