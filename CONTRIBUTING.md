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

### Releasing one package on its own

`publish.yml` also runs from the Actions tab, where `target` picks what goes
out: `pypi`, `npm`, `go`, or `all`. `dry_run` is on by default and reports what
would happen without publishing anything — including what it would refuse, so a
rehearsal from a branch tells you the outcome instead of failing.

`target: go` tags the dispatched commit, which must be on `main`. It exists for
when the module needs the tag that a release did not leave behind — the Go SDK
arriving after the other two had already shipped that version, or a release
whose tagging step never ran. The version comes from the three declared
versions, which `verify-versions` still requires to agree, so this publishes the
version the repository already declares rather than a new one.

Tagging a version the Go module has already published is refused: a version is
immutable in the module proxy, and the only way past it is a version bump —
which means bumping all three ports and cutting a normal release. Re-tagging the
same commit is not refused, so re-running a release, or publishing one after the
module was tagged by hand, does what you would expect and nothing else.

## Reporting bugs and asking questions

- Bugs: open a GitHub issue with the bug report template.
- Security: see [`SECURITY.md`](SECURITY.md). **Do not** report via GitHub
  issues.
