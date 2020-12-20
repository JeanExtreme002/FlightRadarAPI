# FlightRadarAPI
API for [Flight Radar 24](https://www.flightradar24.com/) written in Python 3.

[![Python Package](https://github.com/JeanExtreme002/FlightRadarAPI/workflows/Python%20Package/badge.svg)](https://github.com/JeanExtreme002/FlightRadarAPI/actions)
[![Pypi](https://img.shields.io/pypi/v/FlightRadarAPI)](https://pypi.org/project/FlightRadarAPI/)
[![License](https://img.shields.io/pypi/l/FlightRadarAPI)](https://pypi.org/project/FlightRadarAPI/)
[![Python Version](https://img.shields.io/badge/python-3.6%20%7C%203.7%20%7C%203.8-blue)](https://pypi.org/project/FlightRadarAPI/)

# Installing FlightRadarAPI:
```
pip3 install FlightRadarAPI
```

# How to use it?
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
flights = fr_api.get_flights(airline = None, bounds = None)
```

**Getting zones list:**
```
zones = fr_api.get_zones()
```
