# Login, Bookmarks and Flight History

Everything else in this documentation works without an account. Logging in to
your own FlightRadar24 account adds what belongs to it: your bookmarks and, with
a premium subscription, the history of a flight.

## Logging in

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
from FlightRadarAPI import FlightRadar24API

fr_api = FlightRadar24API()
fr_api.login("your@email.com", "your-password")
```

The credentials can also be given to the constructor, which then logs in right
away:

```python
fr_api = FlightRadar24API(user="your@email.com", password="your-password")
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const { FlightRadar24API } = require("flightradarapi");

const frApi = new FlightRadar24API();
await frApi.login("your@email.com", "your-password");
```
:::

:::{tab-item} Go
:sync: go

```go
client := flightradarapi.New()

if err := client.Login(ctx, "your@email.com", "your-password"); err != nil {
    log.Fatal(err)
}
```
:::
::::

A wrong email or password fails with `LoginError` (`ErrLogin` in Go), carrying
the message FlightRadar24 answered with.

Once logged in, the flight feed and the airport details are requested with your
session too.

## Session state

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
fr_api.is_logged_in()     # True

user = fr_api.get_login_data()   # dict with the data of your account

fr_api.logout()           # True when the server confirmed it
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
frApi.isLoggedIn();       // true

const user = frApi.getLoginData();   // object with the data of your account

await frApi.logout();     // true when the server confirmed it
```
:::

:::{tab-item} Go
:sync: go

```go
client.IsLoggedIn()       // true

user, err := client.GetLoginData()   // map[string]any with the data of your account

confirmed, err := client.Logout(ctx)   // true when the server confirmed it
```
:::
::::

- `get_login_data` returns a copy of the account data FlightRadar24 sent at
  login. Without a session it fails with `LoginError`.
- `logout` always ends the local session and clears its cookies. It returns
  whether the server confirmed the logout, and `true` when there was no session
  to end.
- Logging in again replaces the current session.

## Bookmarks

The bookmarks saved in your account, as FlightRadar24 sends them.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
bookmarks = fr_api.get_bookmarks()   # dict
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const bookmarks = await frApi.getBookmarks();   // object
```
:::

:::{tab-item} Go
:sync: go

```go
bookmarks, err := client.GetBookmarks(ctx)   // map[string]any
```
:::
::::

## Flight history

```{important}
Downloading the history of a flight requires a FlightRadar24 premium
subscription.
```

`get_history_data` downloads the track of a flight as a CSV or KML document.

| Parameter | Meaning |
|---|---|
| flight | The flight to download, as a `Flight` from any call that returns flights. |
| file type | `"CSV"` or `"KML"`, in any letter case. |
| timestamp | The scheduled time of departure (STD) of the flight in UTC, as a Unix timestamp. |

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
history_data = fr_api.get_history_data(flight, file_type="CSV", timestamp=1706529600)

with open("history_data.csv", "w") as file:
    file.write(history_data)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const fs = require("fs");

const historyData = await frApi.getHistoryData(flight, "CSV", 1706529600);

fs.writeFileSync("history_data.csv", Buffer.from(historyData));
```
:::

:::{tab-item} Go
:sync: go

```go
historyData, err := client.GetHistoryData(ctx, flight, "CSV", 1706529600)

if err != nil {
    log.Fatal(err)
}

err = os.WriteFile("history_data.csv", []byte(historyData), 0o644)
```
:::
::::

```{warning}
If an invalid time is provided, a blank document is returned.
```

Calling it without a session fails with `LoginError`. Any file type other than
CSV or KML is rejected before the request: with `ValueError` in Python,
`TypeError` in Node.js and an error in Go.
