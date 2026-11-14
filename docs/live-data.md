# Most Tracked, Disruptions and Eruptions

Three calls return a snapshot of what FlightRadar24 is showing right now. None
takes a parameter, and each returns the payload as FlightRadar24 sends it: a
`dict` in Python, an `object` in Node.js and a `map[string]any` in Go.

```{note}
The shape of these payloads is defined by FlightRadar24 and may change. Inspect
a response before relying on a particular field.
```

## Most tracked flights

The flights most people are following on FlightRadar24 at the moment.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
most_tracked = fr_api.get_most_tracked()
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const mostTracked = await frApi.getMostTracked();
```
:::

:::{tab-item} Go
:sync: go

```go
mostTracked, err := client.GetMostTracked(ctx)
```
:::
::::

## Airport disruptions

The airports currently affected by delays and cancellations.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
disruptions = fr_api.get_airport_disruptions()
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const disruptions = await frApi.getAirportDisruptions();
```
:::

:::{tab-item} Go
:sync: go

```go
disruptions, err := client.GetAirportDisruptions(ctx)
```
:::
::::

## Volcanic eruptions

The boundaries of the volcanic eruptions and ash clouds impacting aviation.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
eruptions = fr_api.get_volcanic_eruptions()
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const eruptions = await frApi.getVolcanicEruptions();
```
:::

:::{tab-item} Go
:sync: go

```go
eruptions, err := client.GetVolcanicEruptions(ctx)
```
:::
::::
