---
title: Node.js
description: API Documentation for Node.js
---

## Installation

To install the FlightRadarAPI for Node.js, use the following npm command:

```bash
npm install flightradarapi
```

## Basic Usage

Start by importing the `FlightRadar24API` class and creating an instance of it:

```javascript
const { FlightRadar24API } = require("flightradarapi");
const frApi = new FlightRadar24API();
```

### Fetching Data

You can fetch various types of data using the following methods:

- **Flights list:**

    ```javascript
    let flights = await frApi.getFlights(...);  // Returns a list of Flight objects
    ```

- **Airports list:**

    ```javascript
    let airports = await frApi.getAirports(...);  // Returns a list of Airport objects
    ```

- **Airlines list:**

    ```javascript
    let airlines = await frApi.getAirlines();
    ```

- **Zones list:**

    ```javascript
    let zones = await frApi.getZones();
    ```

### Fetching Detailed Information

Fetch more information about a specific flight or airport using the following methods:

- **Flight details:**

    ```javascript
    let flightDetails = await frApi.getFlightDetails(flight);
    flight.setFlightDetails(flightDetails);

    console.log("Flying to", flight.destinationAirportName);
    ```

- **Airport details:**

    ```javascript
    let airportDetails = await frApi.getAirportDetails(icao);
    ```

    !!! note
        Arrivals and departures can have a limit `flightLimit` (max value is 100) to display. When you need to reach more than 100 flights you can use additional parameter `page` to view other pages.

## Advanced Usage

### Fetching Flights Above a Specific Position

Use the `getBoundsByPoint(...)` method to fetch flights above a specific position. This method takes `latitude` and `longitude` for your position and `radius` for the distance in meters from your position to designate a tracking area.

```javascript
// Your point is 52°34'04.7"N 13°16'57.5"E from Google Maps and radius 2km
let bounds = frApi.getBoundsByPoint(52.567967, 13.282644, 2000);

let flights = await frApi.getFlights(null, bounds);
```

### Filtering Flights and Airports

Use the `getFlights(...)` method to search for flights by area line, bounds (customized coordinates or obtained by the `getZones()` method), aircraft registration or aircraft type.

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

### Fetching Airport by ICAO or IATA

```javascript
let luklaAirport = await frApi.getAirport("VNLK", true);
```

### Calculating Distance Between Flights and Airports

The `Flight` and `Airport` classes inherit from `Entity`, which contains the `getDistanceFrom(...)` method. This method returns the distance between the self instance and another entity in kilometers.

```javascript
let airport = await frApi.getAirport("KJFK");
let distance = flight.getDistanceFrom(airport);

console.log("The flight is", distance, "km away from the airport.");
```

## Downloading Flight Data :material-information-outline:{ title="This requires a premium subscription" }

You can download flight data in either CSV or KML format. The method `getHistoryData(...)` is used for this purpose. It takes three parameters:

!!! warning inline end
    If an invalid time is provided, a blank document will be returned. 

| Parameter  | Description |
| ------------- | ------------- |
| `flight_id`  | The ID of the flight. This can be obtained from any other function that returns flight details.  |
| `file_type`  | The format of the file to download. This can be either "CSV" or "KML".  |
| `time`  | The scheduled time of departure (STD) of the flight in UTC, as a Unix timestamp. |

Here is an example of how to use this method:

```javascript
let historyData = await frApi.getHistoryData(flight, "csv", 1706529600);

const buffer = Buffer.from(historyData);
fs.writeFile("history_data.csv", buffer);
```

### Setting and Getting Real-time Flight Tracker Parameters

Set it by using the `setFlightTrackerConfig(...)` method. It receives a `FlightTrackerConfig` dataclass instance, but you can also use keyword arguments directly to the method.

Get the current configuration with the `getFlightTrackerConfig()` method, that returns a `FlightTrackerConfig` instance. Note: creating a new `FlightTrackerConfig` instance means resetting all parameters to default.

```javascript
let flightTracker = frApi.getFlightTrackerConfig();
flightTracker.limit = 10

frApi.setFlightTrackerConfig(flightTracker, ...);

let flights = await frApi.getFlights(...);  // Returns only 10 flights
```
