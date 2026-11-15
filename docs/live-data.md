# Most Tracked, Disruptions and Eruptions

Three calls return a snapshot of what FlightRadar24 is showing right now:

- **Most tracked flights**: the flights most people are following at the moment.
- **Airport disruptions**: the airports currently affected by delays and
  cancellations.
- **Volcanic eruptions**: the boundaries of the eruptions and ash clouds
  impacting aviation.

None takes a parameter, and each returns the payload as FlightRadar24 sends it.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
most_tracked = fr_api.get_most_tracked()          # dict
disruptions = fr_api.get_airport_disruptions()    # dict
eruptions = fr_api.get_volcanic_eruptions()       # dict
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const mostTracked = await frApi.getMostTracked();            // object
const disruptions = await frApi.getAirportDisruptions();     // object
const eruptions = await frApi.getVolcanicEruptions();        // object
```
:::

:::{tab-item} Go
:sync: go

```go
mostTracked, err := client.GetMostTracked(ctx)            // map[string]any
disruptions, err := client.GetAirportDisruptions(ctx)     // map[string]any
eruptions, err := client.GetVolcanicEruptions(ctx)        // map[string]any
```
:::
::::

```{note}
The shape of these payloads is defined by FlightRadar24 and may change. Inspect
a response before relying on a particular field.
```
