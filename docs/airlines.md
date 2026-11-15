# Airlines, Logos and Flags

## Listing the airlines

`get_airlines` returns every airline FlightRadar24 knows, with its name and
codes.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
airlines = fr_api.get_airlines()

print(airlines[0])
# e.g. {"Name": "TAP", "ICAO": "TAP", "IATA": "TP", "n_aircrafts": None}
```

Each airline is a dictionary with the keys `Name`, `ICAO`, `IATA` and
`n_aircrafts`.
:::

:::{tab-item} Node.js
:sync: node

```javascript
const airlines = await frApi.getAirlines();

console.log(airlines[0]);
// e.g. { Name: "TAP", ICAO: "TAP", IATA: "TP", n_aircrafts: null }
```

Each airline is an object with the keys `Name`, `ICAO`, `IATA` and
`n_aircrafts`.
:::

:::{tab-item} Go
:sync: go

```go
airlines, err := client.GetAirlines(ctx)

if err != nil {
    log.Fatal(err)
}

fmt.Println(airlines[0].Name, airlines[0].ICAO, airlines[0].IATA)
```

Each airline is an `Airline`, with the fields `Name`, `ICAO`, `IATA` and
`NumAircrafts` (a `*int`). Marshalled to JSON, it uses the same keys as the
other SDKs: `Name`, `ICAO`, `IATA` and `n_aircrafts`.
:::
::::

| Key | Meaning |
|---|---|
| `Name` | Name of the airline |
| `ICAO` | ICAO code (3 characters), when the airline has one |
| `IATA` | IATA code (2 characters), when the airline has one |
| `n_aircrafts` | Size of the fleet. FlightRadar24 only publishes it for the airlines with the largest fleets; it is empty for the others. |

The ICAO code is what the [flight search](flights.md#filtering) takes as its
airline filter.

## Airline logos

`get_airline_logo` downloads the logo of an airline, given its IATA and ICAO
codes. The result is the image bytes and the file extension, or nothing when
FlightRadar24 has no logo for that airline.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
logo = fr_api.get_airline_logo("EK", "UAE")

if logo is not None:
    data, extension = logo

    with open(f"emirates.{extension}", "wb") as file:
        file.write(data)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const fs = require("fs");

const logo = await frApi.getAirlineLogo("EK", "UAE");

if (logo !== null) {
    const [data, extension] = logo;

    fs.writeFileSync(`emirates.${extension}`, Buffer.from(data));
}
```
:::

:::{tab-item} Go
:sync: go

```go
logo, err := client.GetAirlineLogo(ctx, "EK", "UAE")

if err != nil {
    log.Fatal(err)
}

if logo != nil {
    err = os.WriteFile("emirates."+logo.Extension, logo.Data, 0o644)
}
```

The result is an `*Image`, with the fields `Data` and `Extension`. It is `nil`,
with a `nil` error, when there is no logo.
:::
::::

## Country flags

`get_country_flag` downloads the flag of a country, given its name. It returns
the same shape as the logo, or nothing when FlightRadar24 has no such flag.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
flag = fr_api.get_country_flag("Brazil")

if flag is not None:
    data, extension = flag

    with open(f"brazil.{extension}", "wb") as file:
        file.write(data)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const flag = await frApi.getCountryFlag("Brazil");

if (flag !== null) {
    const [data, extension] = flag;

    fs.writeFileSync(`brazil.${extension}`, Buffer.from(data));
}
```
:::

:::{tab-item} Go
:sync: go

```go
flag, err := client.GetCountryFlag(ctx, "Brazil")

if err != nil {
    log.Fatal(err)
}

if flag != nil {
    err = os.WriteFile("brazil."+flag.Extension, flag.Data, 0o644)
}
```
:::
::::

The name is matched loosely: `"United States"`, `"united-states"` and the
country of an airport (`airport.country`) all work.
