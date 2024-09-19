# FlightRadarAPI
Unofficial SDK for [FlightRadar24](https://www.flightradar24.com/) for Python 3 and Node.js.

This SDK should only be used for your own educational purposes. If you are interested in accessing Flightradar24 data commercially, please contact business@fr24.com. See more information at [Flightradar24's terms and conditions](https://www.flightradar24.com/terms-and-conditions).

**Official FR24 API**: https://fr24api.flightradar24.com/

[![Node.js Package](https://github.com/JeanExtreme002/FlightRadarAPI/actions/workflows/node-package.yml/badge.svg)](https://github.com/JeanExtreme002/FlightRadarAPI/actions)
[![Pypi](https://img.shields.io/pypi/v/FlightRadarAPI?logo=pypi)](https://pypi.org/project/FlightRadarAPI/)
[![License](https://img.shields.io/pypi/l/FlightRadarAPI)](https://github.com/JeanExtreme002/FlightRadarAPI)
[![Python Version](https://img.shields.io/badge/python-3.7+-8A2BE2)](https://pypi.org/project/FlightRadarAPI/)
[![Npm](https://img.shields.io/npm/v/flightradarapi?logo=npm&color=red)](https://www.npmjs.com/package/flightradarapi)
[![Downloads](https://static.pepy.tech/personalized-badge/flightradarapi?period=total&units=international_system&left_color=grey&right_color=orange&left_text=downloads)](https://pypi.org/project/FlightRadarAPI/)
[![Frequency](https://img.shields.io/pypi/dm/flightradarapi?style=flat&label=frequency)](https://pypi.org/project/FlightRadarAPI/)

## Installing FlightRadarAPI:
```
$ npm install flightradarapi
```

## Basic Usage:

Import the class `FlightRadar24API` and create an instance of it.
```javascript
const { FlightRadar24API } = require("flightradarapi");
const frApi = new FlightRadar24API();
```

**Getting flights list:**
```javascript
let flights = await frApi.getFlights(...);  // Returns a list of Flight objects
```

**Getting airports list:**
```javascript
let airports = await frApi.getAirports(...);  // Returns a list of Airport objects
```

**Getting airlines list:**
```javascript
let airlines = await frApi.getAirlines();
```

**Getting zones list:**
```javascript
let zones = await frApi.getZones();
```

## Documentation
Explore the documentation of FlightRadarAPI package, for Python or NodeJS, through [this site](https://JeanExtreme002.github.io/FlightRadarAPI/).
