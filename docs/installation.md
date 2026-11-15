# Installation

FlightRadarAPI ships as three packages, one per language. They carry the same
features and are released together, under the same version number.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

Install from [PyPI](https://pypi.org/project/FlightRadarAPI/):

```bash
pip install FlightRadarAPI
```

```python
from FlightRadarAPI import FlightRadar24API
```
:::

:::{tab-item} Node.js
:sync: node

Install from [npm](https://www.npmjs.com/package/flightradarapi):

```bash
npm install flightradarapi
```

```javascript
const { FlightRadar24API } = require("flightradarapi");
```

TypeScript declarations are bundled with the package.
:::

:::{tab-item} Go
:sync: go

Add the module to your project:

```bash
go get github.com/JeanExtreme002/FlightRadarAPI/go@latest
```

```go
import "github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi"
```
:::
::::

## Requirements

| SDK | Runtime |
|---|---|
| Python | Python 3.10 or later |
| Node.js | Node.js 18.17 or later |
| Go | Go 1.26 or later |

The dependencies are installed for you by `pip`, `npm` and `go get`.

## Checking the installed version

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
import FlightRadarAPI

print(FlightRadarAPI.__version__)
```
:::

:::{tab-item} Node.js
:sync: node

```javascript
const { version } = require("flightradarapi");

console.log(version);
```
:::

:::{tab-item} Go
:sync: go

```go
fmt.Println(flightradarapi.Version)
```
:::
::::

This documentation describes version {{ release }}.
