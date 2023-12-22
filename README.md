# FlightRadarAPI
Unofficial SDK for [FlightRadar24](https://www.flightradar24.com/) for Python 3 and NodeJS.

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
pip install FlightRadarAPI
```

## Basic Usage:
Import the class `FlightRadar24API` and create an instance of it.
```py
from FlightRadar24 import FlightRadar24API
fr_api = FlightRadar24API(...)
```

**Getting flights list:**
```py
flights = fr_api.get_flights(...)  # Returns a list of Flight objects
```

**Getting airports list:**
```py
airports = fr_api.get_airports(...)  # Returns a list of Airport objects
```

**Getting airlines list:**
```py
airlines = fr_api.get_airlines()
```

**Getting zones list:**
```py
zones = fr_api.get_zones()
```

### Getting flight and airport details
You can also get more information about a specific flight such as: estimated time, trail, aircraft details, etc.
```py
flight_details = fr_api.get_flight_details(flight)
flight.set_flight_details(flight_details)

print("Flying to", flight.destination_airport_name)
```

Or get more information about a specific airport such as: runways, temperature, arrived flights, etc.
```py
airport_details = fr_api.get_airport_details(airport.icao)
```
Arrivals and departures can have a limit `flight_limit` (max value is 100) to display. When you need to reach more than 100 flights you can use additional parameter `page` to view other pages.


## Get flights above your position:
The `get_bounds_by_point(...)` method has parameters `latitude` and `longitude` for your position and `radius` for the distance in meters from your position to designate a tracking area.
```py
# Your point is 52°34'04.7"N 13°16'57.5"E from Google Maps and radius 2km
bounds = fr_api.get_bounds_by_point(52.567967, 13.282644, 2000)

flights = fr_api.get_flights(bounds = bounds)
```

## Filtering flights and airports:
The `get_flights(...)` method has some parameters to search for flights by: area line, bounds (customized coordinates 
or obtained by the `get_zones()` method), aircraft registration or aircraft type. See the example below:
```py
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
```py
lukla_airport = fr_api.get_airport(code = "VNLK")
```

## Getting the distance between flights and airports:
The `Flight` and `Airport` classes inherit from `Entity`, which contains the `get_distance_from(...)` method. That method
returns the distance between the self instance and another entity in kilometers. Example:
```py
airport = fr_api.get_airport("KJFK")
distance = flight.get_distance_from(airport)

print(f"The flight is {distance} km away from the airport.")
```

## Setting and getting Real-time Flight Tracker parameters:
Set it by using the `set_flight_tracker_config(...)` method. It receives a `FlightTrackerConfig` dataclass instance, but
you can also use keyword arguments directly to the method.

Get the current configuration with the `get_flight_tracker_config()` method, that returns a `FlightTrackerConfig` 
instance. Note: creating a new `FlightTrackerConfig` instance means resetting all parameters to default.
```py
flight_tracker = fr_api.get_flight_tracker_config()
flight_tracker.limit = 10

fr_api.set_flight_tracker_config(flight_tracker, ...)

flights = fr_api.get_flights(...)  # Returns only 10 flights
```
