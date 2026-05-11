# -*- coding: utf-8 -*-
"""Test doubles for the request layer.

Lives in its own module (not in ``conftest.py``) so both ``test_request_policy``
and ``test_request_transport`` can import them. The two suites are split
deliberately:

- ``test_request_policy`` covers **product rules** that survive a transport
  rewrite: retry semantics, Cloudflare detection rules, error taxonomy.
- ``test_request_transport`` covers **adapter-shaped behavior** that will
  need to be rewritten when curl_cffi is replaced (e.g. with httpx,
  niquests, or whatever the next Cloudflare round demands): GET/POST
  dispatch, query-string encoding, content-type dispatch.

When the HTTP library changes, expect to throw away ``test_request_transport``
and rewrite the stubs; ``test_request_policy`` should keep passing unchanged.
"""

from typing import Any, Dict, List, Optional


class FakeHeaders:
    """Case-insensitive header bag matching the curl_cffi response.headers API.

    Real HTTP libraries treat header names case-insensitively per RFC 7230.
    Production code mixes ``Content-Type`` and ``cf-mitigated`` lookups, so
    test doubles must too — otherwise lookups silently return the default
    and tests pass-or-fail for the wrong reason.
    """

    def __init__(self, mapping: Optional[Dict[str, str]] = None) -> None:
        self._data: Dict[str, str] = {}
        if mapping:
            for k, v in mapping.items():
                self._data[k.lower()] = v

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key.lower(), default)

    def __getitem__(self, key: str) -> str:
        return self._data[key.lower()]

    def __contains__(self, key: object) -> bool:
        return isinstance(key, str) and key.lower() in self._data


class FakeResponse:
    """Minimal stand-in for a curl_cffi response object.

    ``APIRequest`` only touches ``.status_code``, ``.headers``, ``.content``,
    and ``.raise_for_status()`` — that's all we have to implement.
    """

    def __init__(
        self,
        *,
        status_code: int = 200,
        headers: Optional[Dict[str, str]] = None,
        content: bytes = b"",
    ) -> None:
        self.status_code = status_code
        self.headers = FakeHeaders(headers or {})
        self.content = content

    def raise_for_status(self) -> None:
        if 400 <= self.status_code < 600:
            raise RuntimeError(f"HTTP {self.status_code}")


class StubSession:
    """Session double whose ``.get`` / ``.post`` return a pre-baked response.

    Tracks every call in ``self.calls`` for inspection.
    """

    def __init__(self, response: FakeResponse) -> None:
        self._response = response
        self.calls: List[Dict[str, Any]] = []

    def _record(self, url: str, **kwargs: Any) -> FakeResponse:
        self.calls.append({"url": url, **kwargs})
        return self._response

    def get(self, url: str, **kwargs: Any) -> FakeResponse:
        return self._record(url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> FakeResponse:
        return self._record(url, **kwargs)
