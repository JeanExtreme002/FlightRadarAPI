# Flight Tracker Settings

The client keeps a set of options that it sends with every
[flight search](flights.md): which data sources to include, whether to show
aircraft on the ground, how many flights to return. They are the same switches
as the filters of the FlightRadar24 map, and they live in a
`FlightTrackerConfig`.

## Options

Every value is a string holding a number. The switches take `"1"` (on) or `"0"`
(off).

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

| Option | Default | Meaning |
|---|---|---|
| `faa` | `"1"` | Include data from the FAA |
| `satellite` | `"1"` | Include satellite-based tracking |
| `mlat` | `"1"` | Include MLAT (multilateration) positions |
| `flarm` | `"1"` | Include FLARM positions |
| `adsb` | `"1"` | Include ADS-B positions |
| `gnd` | `"1"` | Include aircraft on the ground |
| `air` | `"1"` | Include aircraft in the air |
| `vehicles` | `"1"` | Include ground vehicles |
| `estimated` | `"1"` | Include estimated positions |
| `maxage` | `"14400"` | Maximum age of a position, in seconds |
| `gliders` | `"1"` | Include gliders |
| `stats` | `"1"` | Include the feed statistics in the response |
| `limit` | `"5000"` | Maximum number of flights returned |
:::

:::{tab-item} Node.js
:sync: node

| Option | Default | Meaning |
|---|---|---|
| `faa` | `"1"` | Include data from the FAA |
| `satellite` | `"1"` | Include satellite-based tracking |
| `mlat` | `"1"` | Include MLAT (multilateration) positions |
| `flarm` | `"1"` | Include FLARM positions |
| `adsb` | `"1"` | Include ADS-B positions |
| `gnd` | `"1"` | Include aircraft on the ground |
| `air` | `"1"` | Include aircraft in the air |
| `vehicles` | `"1"` | Include ground vehicles |
| `estimated` | `"1"` | Include estimated positions |
| `maxage` | `"14400"` | Maximum age of a position, in seconds |
| `gliders` | `"1"` | Include gliders |
| `stats` | `"1"` | Include the feed statistics in the response |
| `limit` | `"5000"` | Maximum number of flights returned |
:::

:::{tab-item} Go
:sync: go

| Field | Default | Meaning |
|---|---|---|
| `FAA` | `"1"` | Include data from the FAA |
| `Satellite` | `"1"` | Include satellite-based tracking |
| `MLAT` | `"1"` | Include MLAT (multilateration) positions |
| `FLARM` | `"1"` | Include FLARM positions |
| `ADSB` | `"1"` | Include ADS-B positions |
| `GND` | `"1"` | Include aircraft on the ground |
| `Air` | `"1"` | Include aircraft in the air |
| `Vehicles` | `"1"` | Include ground vehicles |
| `Estimated` | `"1"` | Include estimated positions |
| `MaxAge` | `"14400"` | Maximum age of a position, in seconds |
| `Gliders` | `"1"` | Include gliders |
| `Stats` | `"1"` | Include the feed statistics in the response |
| `Limit` | `"5000"` | Maximum number of flights returned |
:::

::::

```{note}
These are the query parameters of FlightRadar24's own feed, and FlightRadar24
does not document them. The meanings above describe how its map uses them.
```

## Changing the settings

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

Pass single options as keyword arguments:

```python
fr_api.set_flight_tracker_config(limit=10, gnd=0)

flights = fr_api.get_flights()   # at most 10 flights, none on the ground
```

Or read the current settings, change them and set them back:

```python
config = fr_api.get_flight_tracker_config()
config.limit = "10"

fr_api.set_flight_tracker_config(config)
```

Both forms can be combined: `set_flight_tracker_config(config, gnd=0)` replaces
the settings with `config` and then applies the keyword arguments on top.

Keyword values may be integers or numeric strings. An unknown option raises
`KeyError` and a value that is not a number raises `TypeError`.
:::

:::{tab-item} Node.js
:sync: node

Pass single options as an object, in the second argument:

```javascript
frApi.setFlightTrackerConfig(null, { limit: 10, gnd: 0 });

const flights = await frApi.getFlights();   // at most 10 flights, none on the ground
```

Or read the current settings, change them and set them back:

```javascript
const config = frApi.getFlightTrackerConfig();
config.limit = 10;

frApi.setFlightTrackerConfig(config);
```

Both forms can be combined: `setFlightTrackerConfig(config, { gnd: 0 })`
replaces the settings with `config` and then applies the object on top.

Values may be numbers or numeric strings. An unknown option throws `RangeError`
and a value that is not a number throws `TypeError`, both when calling
`setFlightTrackerConfig` and when assigning to a `FlightTrackerConfig`.
:::

:::{tab-item} Go
:sync: go

Pass single options as a map, in the second argument:

```go
err := client.SetFlightTrackerConfig(nil, map[string]string{"limit": "10", "gnd": "0"})

flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{})   // at most 10 flights, none on the ground
```

The keys of the map are the field names in lower case: `limit`, `maxage`, `gnd`.

Or read the current settings, change them and set them back:

```go
config := client.GetFlightTrackerConfig()
config.Limit = "10"

err := client.SetFlightTrackerConfig(&config, nil)
```

Either argument may be `nil`. With both, the config replaces the settings and
the map is applied on top. A field left empty in the config takes its default,
so `&flightradarapi.FlightTrackerConfig{Limit: "10"}` changes the limit only.

An unknown option or a value that is not a number returns an error, and a
rejected update leaves the current settings untouched.
:::
::::

## Reading and resetting

Reading the settings returns a copy: changing it has no effect until you set it
back. A new `FlightTrackerConfig` carries the defaults, so setting one resets
everything.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
from FlightRadarAPI import FlightTrackerConfig

fr_api.set_flight_tracker_config(FlightTrackerConfig())             # back to the defaults
fr_api.set_flight_tracker_config(FlightTrackerConfig(limit="100"))  # defaults, except the limit
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const { FlightTrackerConfig } = require("flightradarapi");

frApi.setFlightTrackerConfig(new FlightTrackerConfig());                 // back to the defaults
frApi.setFlightTrackerConfig(new FlightTrackerConfig({ limit: 100 }));   // defaults, except the limit
```
:::

:::{tab-item} Go
:sync: go

```go
defaults := flightradarapi.NewFlightTrackerConfig()

err := client.SetFlightTrackerConfig(&defaults, nil)   // back to the defaults
```
:::
::::
