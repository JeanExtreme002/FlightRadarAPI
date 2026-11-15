# Distances

`Flight` and `Airport` are both an `Entity`: something with a latitude and a
longitude. Any two entities can measure the distance between them, in
kilometers, along the surface of the Earth.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
airport = fr_api.get_airport("KJFK")
distance = flight.get_distance_from(airport)

print(f"The flight is {distance:.1f} km away from the airport.")
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const airport = await frApi.getAirport("KJFK");
const distance = flight.getDistanceFrom(airport);

console.log(`The flight is ${distance.toFixed(1)} km away from the airport.`);
```
:::

:::{tab-item} Go
:sync: go

```go
airport, err := client.GetAirport(ctx, "KJFK", false)

if err != nil {
    log.Fatal(err)
}

distance, err := flight.GetDistanceFrom(airport)

if err != nil {
    log.Fatal(err)
}

fmt.Printf("The flight is %.1f km away from the airport.\n", distance)
```

`GetDistanceFrom` takes anything that implements `Positioned`, which both
`*Flight` and `*Airport` do.
:::
::::

It works in every combination: flight to airport, airport to airport, flight to
flight.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
jfk = fr_api.get_airport("JFK")
heathrow = fr_api.get_airport("LHR")

print(jfk.get_distance_from(heathrow))   # about 5540 km
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const jfk = await frApi.getAirport("JFK");
const heathrow = await frApi.getAirport("LHR");

console.log(jfk.getDistanceFrom(heathrow));   // about 5540 km
```
:::

:::{tab-item} Go
:sync: go

```go
jfk, err := client.GetAirport(ctx, "JFK", false)
heathrow, err := client.GetAirport(ctx, "LHR", false)

distance, err := jfk.GetDistanceFrom(heathrow)   // about 5540 km
```
:::
::::

## Entities without a position

A distance needs both positions. The airports returned by the
[airports listing](airports.md#airports-of-a-country) have none, and a flight
may be missing its own.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

An airport without a position holds `None`, and the call raises `ValueError`.
A flight without one holds the string `"N/A"`, and the call raises `TypeError`.
:::

:::{tab-item} Node.js
:sync: node

An airport without a position holds `null`, and the call throws `TypeError`.
A flight without one holds the string `"N/A"`, and the call returns `NaN`
instead of throwing: check the result, or the coordinates, before using it.
:::

:::{tab-item} Go
:sync: go

A missing position is `nil`, and the call returns an error wrapping
`ErrFlightRadar`.
:::
::::

To measure from a listed airport, fetch it by its code first: that one carries
the coordinates.
