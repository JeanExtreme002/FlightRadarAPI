# Countries

The [airports listing](airports.md#airports-of-a-country) is narrowed by
country. Each SDK names the countries FlightRadar24 lists, so you do not
have to spell them.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

`Countries` is an `Enum`. The value of each member is the slug of the country.

```python
from FlightRadarAPI import Countries

Countries.BRAZIL.value          # "brazil"

airports = fr_api.get_airports([Countries.BRAZIL, Countries.UNITED_STATES])

for country in Countries:       # every country
    print(country.name, country.value)
```
:::

:::{tab-item} Node.js
:sync: node

`Countries` is a frozen object. Each property holds the slug of the country.

```javascript
const { Countries } = require("flightradarapi");

Countries.BRAZIL;               // "brazil"

const airports = await frApi.getAirports([Countries.BRAZIL, Countries.UNITED_STATES]);

for (const [name, slug] of Object.entries(Countries)) {   // every country
    console.log(name, slug);
}
```
:::

:::{tab-item} Go
:sync: go

`Country` is a string type, with one constant per country. Each constant holds
the slug of the country.

```go
flightradarapi.CountryBrazil    // "brazil"

airports, err := client.GetAirports(ctx, []flightradarapi.Country{
    flightradarapi.CountryBrazil,
    flightradarapi.CountryUnitedStates,
})

for _, country := range flightradarapi.AllCountries() {   // every country
    fmt.Println(country)
}
```
:::
::::

## Names and slugs

A slug is the name of a country the way FlightRadar24 spells it in its URLs:
lower case, with hyphens. The constants are a convenience, not a requirement.
Wherever a country is expected, a slug or a plain name works too, and is
normalized the same way: `"United States"`, `"united-states"` and
`Countries.UNITED_STATES` select the same country.

This also means a country FlightRadar24 adds before the SDK names it can be
reached by its name.
