# FlightRadarAPI
Unofficial API for [Flight Radar 24](https://www.flightradar24.com/) written in Python 3.

If you want to use the data collected using this API commercially, you need to subscribe to the [Business plan](https://www.flightradar24.com/premium/).</br>
See more information at: https://www.flightradar24.com/terms-and-conditions

[![Python Package](https://github.com/JeanExtreme002/FlightRadarAPI/workflows/Python%20Package/badge.svg)](https://github.com/JeanExtreme002/FlightRadarAPI/actions)
[![Pypi](https://img.shields.io/pypi/v/FlightRadarAPI)](https://pypi.org/project/FlightRadarAPI/)
[![License](https://img.shields.io/pypi/l/FlightRadarAPI)](https://pypi.org/project/FlightRadarAPI/)
[![Python Version](https://img.shields.io/badge/python-3.6%20%7C%203.7%20%7C%203.8-blue)](https://pypi.org/project/FlightRadarAPI/)
[![Downloads](https://static.pepy.tech/personalized-badge/flightradarapi?period=total&units=international_system&left_color=grey&right_color=orange&left_text=Downloads)](https://pypi.org/project/FlightRadarAPI/)

# Installing FlightRadarAPI:
```
pip3 install FlightRadarAPI
```

# Basic Usage:
Just create a `FlightRadar24API` object after importing it.

```
from FlightRadar24.api import FlightRadar24API
fr_api = FlightRadar24API()
```

**Getting airports list:**
```
airports = fr_api.get_airports()
```

**Getting airlines list:**
```
airlines = fr_api.get_airlines()
```

**Getting flights list:**
```
flights = fr_api.get_flights()
```

**Getting zones list:**
```
zones = fr_api.get_zones()
```

You can also get more information about a specific flight such as: aircraft images, estimated time, trail, etc.
```
details = fr_api.get_flight_details(flight.id)
flight.set_flight_details(details)

print("Flying to", flight.destination_airport_name)
```

# Filtering flights and airports:
**Getting flights by airline:**
```
airline_icao = "AZU"
thy_flights = fr_api.get_flights(airline = airline_icao)
```

**Getting flights by bounds:**
```
bounds = fr_api.get_bounds(zone)
flights = fr_api.get_flights(bounds = bounds)
```

**Getting airport by ICAO or IATA:**
```
airport_icao = "VNLK"
lukla_airport = fr_api.get_airport(airport_icao)
```

**Getting and configuring Real-time Flight Tracker parameters:**
```
params = fr_api.get_real_time_flight_tracker_config()
set_real_time_flight_tracker_config(**new_config)
```
