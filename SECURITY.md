# Security Policy

## Supported Versions

Security fixes are applied to the latest minor release on PyPI and npm. Older
versions do not receive backports.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security reports.**

Please email the maintainer with:

- A description of the issue and the affected component (Python SDK, Node SDK,
  CI, or documentation).
- The minimum reproducer you have (a short script is ideal).
- The package version (`pip show FlightRadarAPI` / `npm ls flightradarapi`).
- The impact you believe the issue has.

## Scope

This project is an **unofficial SDK** that consumes endpoints from
flightradar24. The following are explicitly **out of scope** for security
reports:

- The FR24 site or upstream API itself — contact FR24 directly.
- TLS impersonation behavior (intentional; see `request.py` / `request.js`).
- The fact that the SDK can be blocked by Cloudflare under heavy use.
- Anything that requires the user to feed the SDK adversarial input *to their
  own credentials or filesystem*.

## In Scope

- Code execution, injection, or filesystem traversal triggered by a normal
  call surface.
- Credential leakage in logs, error messages, or exception payloads.
- Known-vulnerable transitive dependencies that the SDK actually exercises.
- Improper validation that turns a remote response into local code paths.
