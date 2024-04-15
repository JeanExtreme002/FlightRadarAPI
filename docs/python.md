---
title: Python
description: API Docuemntation for Python
---

## Installation

To install the FlightRadarAPI for Python, use the following pip command:

```bash
pip install FlightRadarAPI
```

## Basic Usage

Start by importing the `FlightRadar24API` class and creating an instance of it:

```python
from FlightRadar24 import FlightRadar24API
fr_api = FlightRadar24API()
```

### Fetching Data

You can fetch various types of data using the following methods:

- **Flights list:**

    ```python
    flights = fr_api.get_flights(...)  # Returns a list of Flight objects
    ```

- **Airports list:**

    ```python
    airports = fr_api.get_airports(...)  # Returns a list of Airport objects
    ```

- **Airlines list:**

    ```python
    airlines = fr_api.get_airlines()
    ```

- **Zones list:**

    ```python
    zones = fr_api.get_zones()
    ```

### Fetching Detailed Information

Fetch more information about a specific flight or airport using the following methods:

- **Flight details:**

    ```python
    flight_details = fr_api.get_flight_details(flight)
    flight.set_flight_details(flight_details)

    print("Flying to", flight.destination_airport_name)
    ```

- **Airport details:**

    ```python
    airport_details = fr_api.get_airport_details(icao)
    ```

    Note: Arrivals and departures can have a limit `flight_limit` (max value is 100) to display. When you need to reach more than 100 flights you can use additional parameter `page` to view other pages.

## Advanced Usage

### Fetching Flights Above a Specific Position

Use the `get_bounds_by_point(...)` method to fetch flights above a specific position. This method takes `latitude` and `longitude` for your position and `radius` for the distance in meters from your position to designate a tracking area.

```python
# Your point is 52°34'04.7"N 13°16'57.5"E from Google Maps and radius 2km
bounds = fr_api.get_bounds_by_point(52.567967, 13.282644, 2000)

flights = fr_api.get_flights(bounds = bounds)
```

### Filtering Flights and Airports

Use the `get_flights(...)` method to search for flights by area line, bounds (customized coordinates or obtained by the `get_zones()` method), aircraft registration or aircraft type.

```python
airline_icao = "UAE"
aircraft_type = "B77W"

# You may also set a custom region, such as: bounds = "73,-12,-156,38"
zone = fr_api.get_zones()["northamerica"]
bounds = fr_api.get_bounds(zone)

emirates_flights = fr_api.get_flights(
    aircraft_type = aircraft_type,
    airline = airline_icao,
    bounds = bounds
)
```

### Fetching Airport by ICAO or IATA

```python
lukla_airport = fr_api.get_airport(code = "VNLK", details = True)
```

### Calculating Distance Between Flights and Airports

The `Flight` and `Airport` classes inherit from `Entity`, which contains the `get_distance_from(...)` method. This method returns the distance between the self instance and another entity in kilometers.

```python
airport = fr_api.get_airport("KJFK")
distance = flight.get_distance_from(airport)

print(f"The flight is {distance} km away from the airport.")
```

### Downloading Flight Data

*Note*: This requires a premium subscription and for you to be logged in.

```py
history_data = fr_api.get_history_data(flight, file_type="csv", time=1706529600)

 with open("history_data.csv", "w") as file:
    file.write(history_data)
```

`flight_id` - The ID of the flight. Can be gotten from any other function that returns flight details.<br>
`file_type` - Either CSV or KML.<br>
`time` - The STD/scheduled time of deperature in UTC of the flight as a Unix timestamp. Putting an invalid time will return a blank document.

### Setting and Getting Real-time Flight Tracker Parameters

Set it by using the `set_flight_tracker_config(...)` method. It receives a `FlightTrackerConfig` dataclass instance, but you can also use keyword arguments directly to the method.

Get the current configuration with the `get_flight_tracker_config()` method, that returns a `FlightTrackerConfig` instance. Note: creating a new `FlightTrackerConfig` instance means resetting all parameters to default.

```python
flight_tracker = fr_api.get_flight_tracker_config()
flight_tracker.limit = 10

fr_api.set_flight_tracker_config(flight_tracker, ...)

flights = fr_api.get_flights(...)  # Returns only 10 flights
```
