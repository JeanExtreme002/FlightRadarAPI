# FlightRadarAPI
Unofficial API for [FlightRadar24](https://www.flightradar24.com/) written in Python 3.

If you want to use the data collected using this API commercially, you need to subscribe to the [Business plan](https://www.flightradar24.com/premium/).</br>
See more information at: https://www.flightradar24.com/terms-and-conditions

[![Python Package](https://github.com/JeanExtreme002/FlightRadarAPI/workflows/Python%20Package/badge.svg)](https://github.com/JeanExtreme002/FlightRadarAPI/actions)
[![Pypi](https://img.shields.io/pypi/v/FlightRadarAPI)](https://pypi.org/project/FlightRadarAPI/)
[![License](https://img.shields.io/pypi/l/FlightRadarAPI)](https://pypi.org/project/FlightRadarAPI/)
[![Python Version](https://img.shields.io/badge/python-3.7%20%7C%203.8%20%7C%203.9%20%7C%203.10%20%7C%203.11-blue)](https://pypi.org/project/FlightRadarAPI/)
[![Downloads](https://static.pepy.tech/personalized-badge/flightradarapi?period=total&units=international_system&left_color=grey&right_color=orange&left_text=Downloads)](https://pypi.org/project/FlightRadarAPI/)

## Installing FlightRadarAPI:
```
pip3 install FlightRadarAPI
```

## Basic Usage:
Import the class `FlightRadar24API` and create an instance of it.
```
from FlightRadar24 import FlightRadar24API
fr_api = FlightRadar24API(...)
```

**Getting flights list:**
```
flights = fr_api.get_flights(...)
```

**Getting airports list:**
```
airports = fr_api.get_airports(...)
```

**Getting airlines list:**
```
airlines = fr_api.get_airlines()
```

**Getting zones list:**
```
zones = fr_api.get_zones()
```

You can also get more information about a specific flight such as: estimated time, trail, aircraft details, etc.
```
flight_details = fr_api.get_flight_details(flight.id)
flight.set_flight_details(flight_details)

print("Flying to", flight.destination_airport_name)
```

Or get more information about a specific airport such as: runways, temperature, arrived flights, etc.
```
airport_details = fr_api.get_airport_details(airport.icao)
```

## Filtering flights and airports:
The `get_flights(...)` method has some parameters to search for flights by: area line, bounds (customized coordinates 
or obtained by the get_zones method), aircraft registration or aircraft type. See the example below:
```
airline_icao = "UAE"
aircraft_type = "B77W"

# You may also set a custom region, such as: bounds = "73,-12,-156,38"
zone = fr_api.get_zones()["northamerica"]
bounds = fr_api.get_bounds(zone)

emirates_flights = fr_api.get_flights(
    aircraft_type = aircraft_type
    airline = airline_icao,
    bounds = bounds
)
```
There are more configurations that you may set by using the `set_flight_tracker_config(...)` method. See the method documentation
for more information.

**Getting airport by ICAO or IATA:**
```
lukla_airport = fr_api.get_airport(code = "VNLK")
```

## Getting the distance between flights and airports:
The `Flight` and `Airport` classes inherit from `Entity`, which contains the `get_distance_from(...)` method. That method
returns the distance between the self instance and another entity in kilometers. Example:
```
airport = fr_api.get_airport("KJFK")
distance = flight.get_distance_from(airport)

print(f"The flight is {distance} km away from the airport.")
```

## Setting and getting Real-time Flight Tracker parameters:
Set it by using the `set_flight_tracker_config(...)` method. It receives a `FlightTrackerConfig` dataclass instance, but
you can also use keyword arguments directly to the method.

Get the current configurations with the `get_flight_tracker_config()` method, that returns a `FlightTrackerConfig` instance.
```
flight_tracker = fr_api.get_flight_tracker_config()
flight_tracker.limit = 10

fr_api.set_flight_tracker_config(flight_tracker, ...)

flights = fr_api.get_flights(...)  # Returns only 10 flights
```
