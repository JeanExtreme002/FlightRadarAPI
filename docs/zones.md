# Zones and Bounds

The flight feed looks at a rectangle of the globe, described by a **bounds**
string. You can write one by hand, take it from a named **zone**, or compute it
around a point.

## The bounds string

Bounds are four comma-separated coordinates, `"y1,y2,x1,x2"`:

| Part | Meaning |
|---|---|
| `y1` | Latitude of the top edge (north) |
| `y2` | Latitude of the bottom edge (south) |
| `x1` | Longitude of the left edge (west) |
| `x2` | Longitude of the right edge (east) |

For example, `"72.57,33.57,-16.96,53.05"` covers Europe. Pass the string as the
bounds filter of a [flight search](flights.md#filtering).

## Zones

FlightRadar24 names the major regions of the globe. They are bundled with the
SDK, so reading them makes no request.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
zones = fr_api.get_zones()

europe = zones["europe"]
# {"tl_y": 72.57, "tl_x": -16.96, "br_y": 33.57, "br_x": 53.05, "subzones": {...}}

bounds = fr_api.get_bounds(europe)            # "72.57,33.57,-16.96,53.05"
flights = fr_api.get_flights(bounds=bounds)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const zones = frApi.getZones();

const europe = zones["europe"];
// { tl_y: 72.57, tl_x: -16.96, br_y: 33.57, br_x: 53.05, subzones: {...} }

const bounds = frApi.getBounds(europe);       // "72.57,33.57,-16.96,53.05"
const flights = await frApi.getFlights(null, bounds);
```

`getZones()` and `getBounds()` are synchronous.
:::

:::{tab-item} Go
:sync: go

```go
zones := client.GetZones()

europe := zones["europe"]
// Zone{TLY: 72.57, TLX: -16.96, BRY: 33.57, BRX: 53.05, Subzones: map[string]Zone{...}}

bounds := client.GetBounds(europe)            // "72.57,33.57,-16.96,53.05"
flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{Bounds: bounds})
```
:::
::::

A zone is the top-left corner (`tl_y`, `tl_x`) and the bottom-right corner
(`br_y`, `br_x`) of the rectangle. Some zones are split further, under
`subzones`:

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
germany = zones["europe"]["subzones"]["germany"]
london = zones["europe"]["subzones"]["uk"]["subzones"]["london"]
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const germany = zones["europe"]["subzones"]["germany"];
const london = zones["europe"]["subzones"]["uk"]["subzones"]["london"];
```
:::

:::{tab-item} Go
:sync: go

```go
germany := zones["europe"].Subzones["germany"]
london := zones["europe"].Subzones["uk"].Subzones["london"]
```
:::
::::

## Around a point

To look at the sky above one place, build the bounds from its coordinates and a
radius in meters. The result is the square that extends that distance from the
point in each direction.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
# 52°34'04.7"N 13°16'57.5"E, and 2 km around it
bounds = fr_api.get_bounds_by_point(52.567967, 13.282644, 2000)

flights = fr_api.get_flights(bounds=bounds)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
// 52°34'04.7"N 13°16'57.5"E, and 2 km around it
const bounds = frApi.getBoundsByPoint(52.567967, 13.282644, 2000);

const flights = await frApi.getFlights(null, bounds);
```
:::

:::{tab-item} Go
:sync: go

```go
// 52°34'04.7"N 13°16'57.5"E, and 2 km around it
bounds := client.GetBoundsByPoint(52.567967, 13.282644, 2000)

flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{Bounds: bounds})
```
:::
::::

## A custom region

Any rectangle works: write the string yourself, or describe it as a zone.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
flights = fr_api.get_flights(bounds="73,-12,-156,38")

# Or from the corners
bounds = fr_api.get_bounds({"tl_y": 73, "tl_x": -156, "br_y": -12, "br_x": 38})
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const flights = await frApi.getFlights(null, "73,-12,-156,38");

// Or from the corners
const bounds = frApi.getBounds({ tl_y: 73, tl_x: -156, br_y: -12, br_x: 38 });
```
:::

:::{tab-item} Go
:sync: go

```go
flights, err := client.GetFlights(ctx, flightradarapi.FlightSearch{Bounds: "73,-12,-156,38"})

// Or from the corners
bounds := client.GetBounds(flightradarapi.Zone{TLY: 73, TLX: -156, BRY: -12, BRX: 38})
```
:::
::::
