# FlightRadarAPI

Unofficial SDK for [FlightRadar24](https://www.flightradar24.com/) written in JavaScript with NodeJS.

If you want to use the data collected using this SDK commercially, you need to subscribe to the [Business plan](https://www.flightradar24.com/premium/).</br>
See more information at: https://www.flightradar24.com/terms-and-conditions

[![Python Package](https://github.com/JeanExtreme002/FlightRadarAPI/workflows/Python%20Package/badge.svg)](https://github.com/JeanExtreme002/FlightRadarAPI/actions)
[![Pypi](https://img.shields.io/pypi/v/FlightRadarAPI?logo=pypi)](https://pypi.org/project/FlightRadarAPI/)
[![License](https://img.shields.io/pypi/l/FlightRadarAPI)](https://github.com/JeanExtreme002/FlightRadarAPI)
[![Python Version](https://img.shields.io/badge/python-3.7+-8A2BE2)](https://pypi.org/project/FlightRadarAPI/)
[![Npm](https://img.shields.io/npm/v/flightradarapi?logo=npm&color=red)](https://www.npmjs.com/package/flightradarapi)
[![Downloads](https://static.pepy.tech/personalized-badge/flightradarapi?period=total&units=international_system&left_color=grey&right_color=orange&left_text=Downloads)](https://pypi.org/project/FlightRadarAPI/)

## Installing FlightRadarAPI:

```
npm install flightradarapi
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

### Getting flight and airport details

You can also get more information about a specific flight such as: estimated time, trail, aircraft details, etc.

```javascript
let flightDetails = await frApi.getFlightDetails(flight);
flight.setFlightDetails(flightDetails);

console.log("Flying to", flight.destinationAirportName);
```

Or get more information about a specific airport such as: runways, weather, arrived flights, etc.

```javascript
let airportDetails = await frApi.getAirportDetails(icao);
```

Arrivals and departures can have a limit `flightLimit` (max value is 100) to display. When you need to reach more than 100 flights you can use additional parameter `page` to view other pages.

## Get flights above your position:

The `getBoundsByPoint(...)` method has parameters `latitude` and `longitude` for your position and `radius` for the distance in meters from your position to designate a tracking area.

```javascript
// Your point is 52°34'04.7"N 13°16'57.5"E from Google Maps and radius 2km
let bounds = frApi.getBoundsByPoint(52.567967, 13.282644, 2000);

let flights = await frApi.getFlights(null, bounds);
```

## Filtering flights and airports:

The `getFlights(...)` method has some parameters to search for flights by: area line, bounds (customized coordinates
or obtained by the `getZones()` method), aircraft registration or aircraft type. See the example below:

```javascript
let airlineIcao = "UAE";
let aircraftType = "B77W";

// You may also set a custom region, such as: bounds = "73,-12,-156,38"
let zone = (await frApi.getZones())["northamerica"];
let bounds = frApi.getBounds(zone);

let emiratesFlights = await frApi.getFlights(
  airlineIcao,
  bounds,
  null,
  aircraftType,
);
```

There are more configurations that you may set by using the `setFlightTrackerConfig(...)` method. See the method documentation
for more information.

**Getting airport by ICAO or IATA:**

```javascript
let luklaAirport = await frApi.getAirport("VNLK", true);
```

## Getting the distance between flights and airports:

The `Flight` and `Airport` classes inherit from `Entity`, which contains the `getDistanceFrom(...)` method. That method
returns the distance between the self instance and another entity in kilometers. Example:

```javascript
let airport = await frApi.getAirport("KJFK");
let distance = flight.getDistanceFrom(airport);

console.log("The flight is", distance, "km away from the airport.");
```

## Setting and getting Real-time Flight Tracker parameters:

Set it by using the `setFlightTrackerConfig(...)` method. It receives a `FlightTrackerConfig` dataclass instance, but
you can also use keyword arguments directly to the method.

Get the current configuration with the `getFlightTrackerConfig()` method, that returns a `FlightTrackerConfig`
instance. Note: creating a new `FlightTrackerConfig` instance means resetting all parameters to default.

```javascript
let flightTracker = frApi.getFlightTrackerConfig();
flightTracker.limit = 10

frApi.setFlightTrackerConfig(flightTracker, ...);

let flights = await frApi.getFlights(...);  // Returns only 10 flights
```
