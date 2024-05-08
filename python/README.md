# FlightRadarAPI
Unofficial SDK for [FlightRadar24](https://www.flightradar24.com/) for Python 3 and Node.js.

If you want to use the data collected using this SDK commercially, you need to subscribe to the [Business plan](https://www.flightradar24.com/premium/).</br>
See more information at: https://www.flightradar24.com/terms-and-conditions

[![Python Package](https://github.com/JeanExtreme002/FlightRadarAPI/workflows/Python%20Package/badge.svg)](https://github.com/JeanExtreme002/FlightRadarAPI/actions)
[![Pypi](https://img.shields.io/pypi/v/FlightRadarAPI?logo=pypi)](https://pypi.org/project/FlightRadarAPI/)
[![License](https://img.shields.io/pypi/l/FlightRadarAPI)](https://github.com/JeanExtreme002/FlightRadarAPI)
[![Python Version](https://img.shields.io/badge/python-3.7+-8A2BE2)](https://pypi.org/project/FlightRadarAPI/)
[![Npm](https://img.shields.io/npm/v/flightradarapi?logo=npm&color=red)](https://www.npmjs.com/package/flightradarapi)
[![Downloads](https://static.pepy.tech/personalized-badge/flightradarapi?period=total&units=international_system&left_color=grey&right_color=orange&left_text=downloads)](https://pypi.org/project/FlightRadarAPI/)
[![Frequency](https://img.shields.io/pypi/dm/flightradarapi?style=flat&label=frequency)](https://pypi.org/project/FlightRadarAPI/)

## Installing FlightRadarAPI:
```
$ pip install FlightRadarAPI
```

## Basic Usage:
Import the class `FlightRadar24API` and create an instance of it.
```py
from FlightRadar24 import FlightRadar24API
fr_api = FlightRadar24API()
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

## Documentation
Explore the documentation of FlightRadarAPI package, for Python or NodeJS, through [this site](https://JeanExtreme002.github.io/FlightRadarAPI/).