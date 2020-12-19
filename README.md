# FlightRadarAPI
API for [Flight Radar 24](https://www.flightradar24.com/) written in Python 3.

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
flights = fr_api.get_flights() # Returns a generator object.
```

**Getting zones list:**
```
zones = fr_api.get_zones()
```
