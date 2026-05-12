# Contributing to FlightRadarAPI

Thanks for your interest. This repo ships two SDKs in parallel — Python and
Node.js — that must stay behavior-aligned, so most non-trivial changes touch
both sides.

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

## Keeping Python and Node aligned

When you change behavior, change it in both SDKs in the same PR unless there
is a documented reason not to. Common targets that must stay in sync:

- Error taxonomy (`AirportNotFoundError`, `LoginError`, `CloudflareError`,
  `FlightRadarError`).
- `RetryPolicy` semantics (which exceptions are transient, backoff math).
- Cloudflare detection rules.
- The public surface — `FlightRadar24API` methods, the `Countries` enum,
  `FlightTrackerConfig` fields, and the `Entity` / `Airport` / `Flight`
  attributes consumers depend on.

## Style

- Python: flake8 + mypy.
- Node: eslint + tsd.
- Comments must explain **why**, not **what**. The codebase has a few exemplars in
  `request.py`/`request.js` — read those before adding new comments.

## Commits and PRs

- Use a descriptive title with a conventional-commits prefix (`fix:`, `feat:`,
  `refactor:`, `docs:`, `ci:`, `test:`).
- For new endpoints or behavior tweaks, add a regression test alongside.

## Releases

Before publishing a new release, the version **must be bumped**. The version lives in two places:

- `python/FlightRadarAPI/__init__.py` (`__version__`)
- `nodejs/package.json` (`version`)

## Reporting bugs and asking questions

- Bugs: open a GitHub issue with the bug report template.
- Security: see [`SECURITY.md`](SECURITY.md). **Do not** report via GitHub
  issues.
