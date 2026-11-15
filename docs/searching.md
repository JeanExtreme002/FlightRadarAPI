# Searching

`search` runs a query through the search of the FlightRadar24 website.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

```python
results = fr_api.search("Emirates")

for category, items in results.items():
    print(category, len(items))
```

The signature is `search(query, limit=50)`.
:::

:::{tab-item} Node.js
:sync: node

```javascript
const results = await frApi.search("Emirates");

for (const [category, items] of Object.entries(results)) {
    console.log(category, items.length);
}
```

The signature is `search(query, limit = 50)`.
:::

:::{tab-item} Go
:sync: go

```go
results, err := client.Search(ctx, "Emirates", 0)

if err != nil {
    log.Fatal(err)
}

for category, items := range results {
    fmt.Println(category, len(items))
}
```

A limit of zero means the default of 50.
:::
::::

## The result

The result groups what was found by category. Each key is a category, as
FlightRadar24 names it in the response, and each value is the list of results of
that category, as FlightRadar24 sends them.

`limit` is sent to FlightRadar24 as the maximum number of results.

```{note}
The categories and the fields of each result are defined by FlightRadar24 and
may change. Inspect a response before relying on a particular field.
```
