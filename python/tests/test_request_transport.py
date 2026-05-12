# -*- coding: utf-8 -*-
"""Transport-level tests for the request layer.

These tests are **coupled to curl_cffi's session interface** (``session.get``,
``session.post`` taking keyword args). When the HTTP library is replaced,
expect to throw away most of this file and rewire the stubs.

What lives here:

- GET vs POST dispatch based on whether ``data`` was provided.
- Query-string encoding into the URL.
- ``get_json_content`` / ``get_bytes_content`` contract enforcement based
  on the response ``Content-Type``.

Deliberately **not** here:

- gzip / brotli decompression. Whether decompression happens in the SDK or
  in the transport layer depends entirely on the library; testing it tells
  us little beyond "the standard library still works". Removed because the
  signal-to-maintenance ratio was poor.
"""

from typing import Any, Dict

import pytest

from FlightRadarAPI.request import APIRequest

from _request_doubles import FakeResponse, StubSession


# --- Content-type contract --------------------------------------------------

class TestContentTypeDispatch:
    def test_json_response_returns_dict(self):
        session = StubSession(FakeResponse(
            status_code=200,
            headers={"content-type": "application/json"},
            content=b'{"a": 1}',
        ))
        req = APIRequest("https://example.com", session=session)  # type: ignore[arg-type]
        assert req.get_json_content() == {"a": 1}

    def test_bytes_response_get_json_raises_value_error(self):
        session = StubSession(FakeResponse(
            status_code=200,
            headers={"content-type": "image/png"},
            content=b"\x89PNG",
        ))
        req = APIRequest("https://example.com", session=session)  # type: ignore[arg-type]
        with pytest.raises(ValueError):
            req.get_json_content()

    def test_json_response_get_bytes_raises_value_error(self):
        session = StubSession(FakeResponse(
            status_code=200,
            headers={"content-type": "application/json"},
            content=b'{"a": 1}',
        ))
        req = APIRequest("https://example.com", session=session)  # type: ignore[arg-type]
        with pytest.raises(ValueError):
            req.get_bytes_content()


# --- Method dispatch --------------------------------------------------------

class TestRequestMethod:
    def test_no_data_uses_get(self):
        session = StubSession(FakeResponse(
            status_code=200, headers={"content-type": "application/json"}, content=b"{}",
        ))
        APIRequest("https://example.com", session=session)  # type: ignore[arg-type]
        # data is forwarded as None when calling GET.
        assert session.calls and session.calls[0]["data"] is None

    def test_data_present_uses_post(self):
        session = StubSession(FakeResponse(
            status_code=200, headers={"content-type": "application/json"}, content=b"{}",
        ))
        APIRequest(
            "https://example.com",
            session=session,  # type: ignore[arg-type]
            data={"email": "a@b.c"},
        )
        assert session.calls[0]["data"] == {"email": "a@b.c"}

    def test_params_are_encoded_into_url(self):
        captured: Dict[str, Any] = {}

        class _CapturingSession(StubSession):
            def get(self, url, **kwargs):  # type: ignore[override]
                captured["url"] = url
                return super().get(url, **kwargs)

        session = _CapturingSession(FakeResponse(
            status_code=200, headers={"content-type": "application/json"}, content=b"{}",
        ))
        APIRequest(
            "https://example.com/api",
            session=session,  # type: ignore[arg-type]
            params={"code": "ATL", "limit": 1},
        )
        assert "code=ATL" in captured["url"]
        assert "limit=1" in captured["url"]
