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

- Whether decompression happens in the SDK or in the transport layer, which
  depends entirely on the library. The decompression *budget* is tested below,
  because that logic is ours and a bomb slipping past it is a real failure.
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


class TestDecompressionLimit:
    """A compressed body must not be trusted to expand to any size.

    An explicit small ``limit`` keeps these fast: a 1 MB expansion against a
    1 KiB cap exercises the same code path as a 4 GB one against 64 MB.
    """

    ONE_MB = b"\x00" * (1024 * 1024)

    def test_brotli_bomb_is_refused(self):
        import brotli

        from FlightRadarAPI.errors import DecompressionLimitError
        from FlightRadarAPI.request import _decompress_brotli

        with pytest.raises(DecompressionLimitError):
            _decompress_brotli(brotli.compress(self.ONE_MB), limit=1024)

    def test_gzip_bomb_is_refused(self):
        import gzip

        from FlightRadarAPI.errors import DecompressionLimitError
        from FlightRadarAPI.request import _decompress_gzip

        with pytest.raises(DecompressionLimitError):
            _decompress_gzip(gzip.compress(self.ONE_MB), limit=1024)

    def test_the_body_is_never_materialised_past_the_cap(self):
        """The cap must bound the work, not just the verdict.

        Regression test: an earlier attempt checked the size only after each
        input chunk, so a small bomb was fully expanded before the check ran
        and the limit reported a breach it had already suffered.
        """
        import brotli
        import tracemalloc

        from FlightRadarAPI.errors import DecompressionLimitError
        from FlightRadarAPI.request import _decompress_brotli

        bomb = brotli.compress(self.ONE_MB * 32)  # 32 MB expanded

        tracemalloc.start()
        try:
            with pytest.raises(DecompressionLimitError):
                _decompress_brotli(bomb, limit=64 * 1024)
            _, peak = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()

        # Generous headroom for the decompressor's own buffers, but nowhere
        # near the 32 MB the body would have expanded to.
        assert peak < 4 * 1024 * 1024, f"peaked at {peak} bytes"

    @pytest.mark.parametrize("encoding", ["br", "gzip"])
    def test_a_body_under_the_limit_round_trips_exactly(self, encoding):
        import gzip

        import brotli

        from FlightRadarAPI.request import _decompress_brotli, _decompress_gzip

        body = b'{"rows": [{"name": "Guarulhos", "iata": "GRU"}]}' * 100
        compress, decompress = {
            "br": (brotli.compress, _decompress_brotli),
            "gzip": (gzip.compress, _decompress_gzip),
        }[encoding]

        assert decompress(compress(body)) == body

    def test_an_empty_body_is_not_mistaken_for_a_bomb(self):
        import gzip

        import brotli

        from FlightRadarAPI.request import _decompress_brotli, _decompress_gzip

        assert _decompress_brotli(brotli.compress(b"")) == b""
        assert _decompress_gzip(gzip.compress(b"")) == b""

    def test_the_encoding_table_uses_the_bounded_helpers(self):
        """A default-limit bomb is too slow to build, so pin the wiring instead."""
        from FlightRadarAPI.request import (
            MAX_DECOMPRESSED_BYTES,
            APIRequest,
            _decompress_brotli,
            _decompress_gzip,
        )

        table = getattr(APIRequest, "_APIRequest__content_encodings")

        assert table["br"] is _decompress_brotli
        assert table["gzip"] is _decompress_gzip
        assert MAX_DECOMPRESSED_BYTES == 64 * 1024 * 1024
