# Contributing to FlightRadarAPI

Thanks for your interest. This repo ships three SDKs in parallel — Python,
Node.js and Go — that must stay behavior-aligned, so most non-trivial changes
touch every side.

## Development setup

### Python
```bash
cd python
make dev-setup          # creates venv, installs package + test extras + tooling
source venv/bin/activate
make test               # runs offline + integration
make lint               # flake8
make type-check         # mypy
```

### Node.js
```bash
cd nodejs
make install
make test               # mocha (all tiers)
make lint               # eslint
make test-types         # tsd
```

### Go
```bash
cd go
make deps
make test               # offline suite (the PR gate)
make test-integration   # live FR24 suite
make lint               # gofmt + go vet
make lint-strict        # adds staticcheck
```

## Keeping the SDKs aligned

When you change behavior, change it in every SDK in the same PR unless there
is a documented reason not to. Common targets that must stay in sync:

- Error taxonomy (`AirportNotFoundError`, `LoginError`, `CloudflareError`,
  `FlightRadarError`).
- `RetryPolicy` semantics (which exceptions are transient, backoff math).
- Cloudflare detection rules.
- The public surface — `FlightRadar24API` methods (`Client` in Go), the
  `Countries` enum (`Country` constants in Go), `FlightTrackerConfig` fields,
  and the `Entity` / `Airport` / `Flight` attributes consumers depend on.
  `docs/go.md` documents where the Go surface deliberately differs.

## Style

- Python: flake8 + mypy.
- Node: eslint + tsd.
- Go: gofmt + go vet + staticcheck.
- Comments must explain **why**, not **what**. The codebase has a few exemplars in
  `request.py`/`request.js`/`request.go` — read those before adding new comments.

## Commits and PRs

- Use a descriptive title with a conventional-commits prefix (`fix:`, `feat:`,
  `refactor:`, `docs:`, `ci:`, `test:`).
- For new endpoints or behavior tweaks, add a regression test alongside.

## Releases

Before publishing a new release, the version **must be bumped**. The version lives in three places:

- `python/FlightRadarAPI/__init__.py` (`__version__`)
- `nodejs/package.json` (`version`)
- `go/flightradarapi/doc.go` (`Version`)

The Go module needs no registry upload — the tag *is* the release. Because it
lives in a subdirectory, the Go toolchain only sees tags carrying that prefix,
so the `tag-go-module` job of `publish.yml` pushes `go/v1.6.0` alongside the
release tag. Nothing to do by hand; if that job is skipped, `go get
.../go@latest` finds no release and callers fall back to a pseudo-version.

## Generated files

`go/flightradarapi/countries.go` and `zones.go` are generated from
`python/FlightRadarAPI/core.py` and `zones.py`. Change the Python source first,
then regenerate them — `go/flightradarapi/ports_test.go` fails with the
exact entries that drifted, and also checks `FlightTrackerConfig` against the
Python dataclass.

## Reporting bugs and asking questions

- Bugs: open a GitHub issue with the bug report template.
- Security: see [`SECURITY.md`](SECURITY.md). **Do not** report via GitHub
  issues.
