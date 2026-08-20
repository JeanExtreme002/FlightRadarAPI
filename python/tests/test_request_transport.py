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

    def test_the_post_hoc_size_check_still_refuses_an_oversized_body(self):
        """Covers the backstop, not the mechanism.

        In production `_bound_download` makes libcurl abort first, so this
        comparison is unreachable — a stub session is the only way to reach it,
        because `setopt` on the double is inert. `TestDownloadBound` is what
        proves the real bound.
        """
        from FlightRadarAPI.errors import DecompressionLimitError
        from FlightRadarAPI.request import MAX_RESPONSE_BYTES

        session = StubSession(FakeResponse(
            status_code=200,
            headers={"Content-Type": "application/json"},
            content=b"x" * 5000,
        ))

        with pytest.raises(DecompressionLimitError):
            APIRequest("https://x.test/", session=session, max_response_bytes=1024)  # type: ignore[arg-type]

        assert MAX_RESPONSE_BYTES == 64 * 1024 * 1024

    def test_a_body_at_the_budget_is_accepted(self):
        session = StubSession(FakeResponse(
            status_code=200,
            headers={"Content-Type": "application/octet-stream"},
            content=b"x" * 1024,
        ))
        request = APIRequest("https://x.test/", session=session, max_response_bytes=1024)  # type: ignore[arg-type]

        assert request.get_bytes_content() == b"x" * 1024

    def test_a_nonsensical_budget_is_rejected_at_the_call(self):
        """Better than turning every response into a confusing limit error."""
        session = StubSession(FakeResponse(status_code=200, content=b"ok"))

        for bad in (0, -1):
            with pytest.raises(ValueError):
                APIRequest("https://x.test/", session=session, max_response_bytes=bad)  # type: ignore[arg-type]

    def test_the_curl_options_are_set_on_every_request(self):
        """Regression: they lapsed after the first request.

        Setting them once at construction looked right and worked once —
        `Session.request` resets the handle, so requests 2..n arrived
        pre-expanded with no budget in reach, and no double-based test noticed
        because each one built a fresh client.
        """
        from curl_cffi import CurlOpt

        session = StubSession(FakeResponse(
            status_code=200,
            headers={"Content-Type": "application/json"},
            content=b"{}",
        ))

        for _ in range(3):
            APIRequest("https://x.test/", session=session, max_response_bytes=4096)  # type: ignore[arg-type]

        assert session.curl.options == [
            (CurlOpt.HTTP_CONTENT_DECODING, 0),
            (CurlOpt.MAXFILESIZE_LARGE, 4096),
        ] * 3

    def test_the_body_is_not_requested_as_a_stream(self):
        """Pins a deliberate trade-off, not an oversight.

        `stream=True` would let the budget act before the body expands, but in
        curl_cffi 0.16 it degrades `timeout` from a wall-clock cap to a
        >=1 byte/sec liveness check, and stops the session reusing connections
        — a fresh TLS handshake per request, which is the fingerprint the
        impersonation exists to avoid. Measured both before choosing.
        """
        session = StubSession(FakeResponse(
            status_code=200,
            headers={"Content-Type": "application/json"},
            content=b"{}",
        ))
        APIRequest("https://x.test/", session=session)  # type: ignore[arg-type]

        assert session.calls[0].get("stream") is None

    def test_the_response_body_stays_readable_for_callers(self):
        """get_response_object() and CloudflareError.response are public.

        A streamed response leaves `.content` empty, so anyone inspecting a
        Cloudflare challenge body would get nothing back.
        """
        session = StubSession(FakeResponse(
            status_code=200,
            headers={"Content-Type": "application/json"},
            content=b'{"a": 1}',
        ))
        request = APIRequest("https://x.test/", session=session)  # type: ignore[arg-type]

        assert request.get_response_object().content == b'{"a": 1}'

    def test_the_encoding_table_uses_the_bounded_helpers(self):
        from FlightRadarAPI.request import _decompress_brotli, _decompress_gzip

        table = getattr(APIRequest, "_APIRequest__content_encodings")

        assert table["br"] is _decompress_brotli
        assert table["gzip"] is _decompress_gzip


class TestDecompressionIntegrity:
    """A partial body must not pass as a whole one."""

    BODY = b'{"rows": [' + b'{"name": "Guarulhos"},' * 500 + b'{}]}'

    def test_a_truncated_gzip_body_raises(self):
        import gzip

        from FlightRadarAPI.request import _decompress_gzip

        blob = gzip.compress(self.BODY)

        with pytest.raises(Exception) as excinfo:
            _decompress_gzip(blob[: len(blob) * 3 // 4])

        # Not the budget error: this body was short, not oversized.
        assert "limit" not in str(excinfo.value)

    def test_a_truncated_brotli_body_raises(self):
        import brotli

        from FlightRadarAPI.request import _decompress_brotli

        blob = brotli.compress(self.BODY)

        with pytest.raises(Exception) as excinfo:
            _decompress_brotli(blob[: len(blob) * 3 // 4])

        assert "limit" not in str(excinfo.value)

    def test_gzip_reads_every_member(self):
        """Concatenated members are legal Content-Encoding: gzip."""
        import gzip

        from FlightRadarAPI.request import _decompress_gzip

        assert _decompress_gzip(gzip.compress(b"first") + gzip.compress(b"second")) == b"firstsecond"

    @pytest.mark.parametrize("encoding", ["br", "gzip"])
    def test_an_already_decoded_body_still_reaches_the_transport_fallback(self, encoding):
        """curl_cffi may decompress for us, leaving plain bytes under a br/gzip header.

        get_content() reads a raised error as "already decoded" and returns the
        raw bytes, so these helpers must raise rather than quietly return b"".
        """
        from FlightRadarAPI.request import _decompress_brotli, _decompress_gzip

        decompress = {"br": _decompress_brotli, "gzip": _decompress_gzip}[encoding]

        with pytest.raises(Exception):
            decompress(b'{"already": "json"}')


class TestBudgetAgainstARealTransport:
    """Exercises the budget over a socket, not over a double.

    A previous attempt at this budget was inert in production and every
    double-based test still passed, because the doubles fed the helpers
    compressed input that the real transport never produced. These tests talk
    to a local server so the decoding path is the production one.
    """

    @staticmethod
    def _serve(blob: bytes, encoding: str):
        import threading
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_GET(self) -> None:
                self.send_response(200)
                self.send_header("Content-Encoding", encoding)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(blob)))
                self.end_headers()
                self.wfile.write(blob)

            def log_message(self, *args: object) -> None:
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        server.daemon_threads = True
        threading.Thread(target=server.serve_forever, daemon=True).start()
        return server

    def test_a_bomb_is_refused_before_it_expands(self):
        import brotli

        from FlightRadarAPI.errors import DecompressionLimitError
        from FlightRadarAPI.request import APIClient

        # A few hundred bytes on the wire, 32 MB expanded.
        server = self._serve(brotli.compress(b"\x00" * (32 * 1024 * 1024)), "br")

        try:
            client = APIClient()
            # Decoded during the request, so the budget lands there rather
            # than on a later read — the same point the Node port enforces it.
            with pytest.raises(DecompressionLimitError):
                client.request(
                    f"http://127.0.0.1:{server.server_port}/",
                    headers={"accept-encoding": "gzip, deflate, br"},
                    max_response_bytes=1024 * 1024,
                )
        finally:
            server.shutdown()

    @pytest.mark.parametrize("encoding", ["br", "gzip", "deflate"])
    def test_every_advertised_encoding_round_trips(self, encoding):
        """Taking decoding from libcurl means decoding everything we advertise.

        `Core.html_headers` asks for deflate, so dropping it here would corrupt
        get_airlines() rather than fail loudly.
        """
        import gzip as gzip_module
        import zlib as zlib_module

        import brotli

        from FlightRadarAPI.request import APIClient

        body = b'{"rows": [{"name": "Guarulhos"}]}'
        compressor = zlib_module.compressobj(wbits=-15)
        blob = {
            "br": brotli.compress(body),
            "gzip": gzip_module.compress(body),
            "deflate": compressor.compress(body) + compressor.flush(),
        }[encoding]

        server = self._serve(blob, encoding)

        try:
            response = APIClient().request(
                f"http://127.0.0.1:{server.server_port}/",
                headers={"accept-encoding": "gzip, deflate, br"},
            )
            assert response.get_json_content() == {"rows": [{"name": "Guarulhos"}]}
        finally:
            server.shutdown()

    def test_the_standalone_path_decodes_and_bounds_too(self):
        """`get_flight_details` uses it from a thread pool, bypassing the session."""
        import brotli

        from FlightRadarAPI.errors import DecompressionLimitError
        from FlightRadarAPI.request import APIClient

        body = b'{"ok": true}'
        server = self._serve(brotli.compress(body), "br")

        try:
            client = APIClient()
            url = f"http://127.0.0.1:{server.server_port}/"
            headers = {"accept-encoding": "gzip, br"}

            assert client.request_standalone(url, headers=headers).get_json_content() == {"ok": True}
        finally:
            server.shutdown()

        server = self._serve(brotli.compress(b"\x00" * (32 * 1024 * 1024)), "br")

        try:
            with pytest.raises(DecompressionLimitError):
                client.request_standalone(
                    f"http://127.0.0.1:{server.server_port}/",
                    headers={"accept-encoding": "gzip, br"},
                    max_response_bytes=1024 * 1024,
                )
        finally:
            server.shutdown()


class TestEncodingRobustness:
    """Owning the decoding means owning every shape the header arrives in."""

    def _serve(self, blob: bytes, encoding: str):
        return TestBudgetAgainstARealTransport._serve(blob, encoding)

    @pytest.mark.parametrize("header", ["gzip", "GZIP", " gzip ", "Gzip"])
    def test_the_encoding_token_is_matched_case_insensitively(self, header):
        """RFC 9110 header values are case-insensitive; an exact match sent
        `GZIP` down the identity path and returned compressed bytes."""
        import gzip as gzip_module

        from FlightRadarAPI.request import APIClient

        server = self._serve(gzip_module.compress(b'{"ok": true}'), header)

        try:
            response = APIClient().request(f"http://127.0.0.1:{server.server_port}/")
            assert response.get_json_content() == {"ok": True}
        finally:
            server.shutdown()

    def test_only_decodable_encodings_are_advertised(self):
        """curl_cffi's impersonation asks for zstd, which nothing here decodes."""
        import threading
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        from FlightRadarAPI.request import APIClient, APIRequest

        seen = []

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_GET(self) -> None:
                seen.append(self.headers.get("accept-encoding"))
                body = b"{}"
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args: object) -> None:
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        server.daemon_threads = True
        threading.Thread(target=server.serve_forever, daemon=True).start()

        try:
            client = APIClient()
            url = f"http://127.0.0.1:{server.server_port}/"
            client.request(url)
            client.request_standalone(url)

            assert seen == [APIRequest.supported_encodings] * 2
            assert "zstd" not in APIRequest.supported_encodings
        finally:
            server.shutdown()

    def test_an_undecodable_encoding_warns_instead_of_passing_bytes_along(self, caplog):
        import gzip as gzip_module

        from FlightRadarAPI.request import APIClient

        server = self._serve(gzip_module.compress(b'{"ok": true}'), "zstd")

        try:
            with caplog.at_level("WARNING", logger="FlightRadarAPI.request"):
                APIClient().request(
                    f"http://127.0.0.1:{server.server_port}/",
                    headers={"accept-encoding": "gzip, zstd"},
                )
            assert any("no decoder for Content-Encoding" in r.message for r in caplog.records)
        finally:
            server.shutdown()

    def test_the_public_response_object_carries_the_decoded_body(self):
        """`CloudflareError.response` is how a user reads a challenge page."""
        import gzip as gzip_module

        from FlightRadarAPI.request import APIClient

        body = b'{"ok": true}'
        server = self._serve(gzip_module.compress(body), "gzip")

        try:
            response = APIClient().request(f"http://127.0.0.1:{server.server_port}/")

            assert response.get_response_object().content == body
            assert response.get_response_object().text == body.decode()
        finally:
            server.shutdown()


class TestDownloadBound:
    """The received bytes are bounded by libcurl, not only checked afterwards."""

    def test_an_oversized_body_is_aborted_mid_download(self):
        import threading
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        from FlightRadarAPI.errors import DecompressionLimitError
        from FlightRadarAPI.request import APIClient

        big = b"x" * (5 * 1024 * 1024)

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_GET(self) -> None:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(big)))
                self.end_headers()
                self.wfile.write(big)

            def log_message(self, *args: object) -> None:
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        server.daemon_threads = True
        threading.Thread(target=server.serve_forever, daemon=True).start()

        try:
            # Surfaced as our own error, not curl's: the retry policy treats
            # curl errors as transient, and retrying an oversized body is futile.
            with pytest.raises(DecompressionLimitError):
                APIClient().request(
                    f"http://127.0.0.1:{server.server_port}/",
                    max_response_bytes=1024 * 1024,
                )
        finally:
            server.shutdown()


class TestSeparateLimits:
    """The wire size and the expanded size are different budgets."""

    def test_the_download_bound_defaults_to_the_expansion_budget(self):
        from curl_cffi import CurlOpt

        session = StubSession(FakeResponse(
            status_code=200,
            headers={"Content-Type": "application/json"},
            content=b"{}",
        ))
        APIRequest("https://x.test/", session=session, max_response_bytes=2048)  # type: ignore[arg-type]

        assert (CurlOpt.MAXFILESIZE_LARGE, 2048) in session.curl.options

    def test_the_download_bound_can_be_set_apart(self):
        """Compression grows incompressible data, so a body that expands to
        just under the budget can still arrive slightly over it."""
        from curl_cffi import CurlOpt

        session = StubSession(FakeResponse(
            status_code=200,
            headers={"Content-Type": "application/json"},
            content=b"{}",
        ))
        APIRequest(  # type: ignore[arg-type]
            "https://x.test/", session=session,
            max_response_bytes=2048, max_download_bytes=4096,
        )

        assert (CurlOpt.MAXFILESIZE_LARGE, 4096) in session.curl.options

    def test_a_nonsensical_download_bound_is_rejected(self):
        session = StubSession(FakeResponse(status_code=200, content=b"ok"))

        with pytest.raises(ValueError):
            APIRequest("https://x.test/", session=session, max_download_bytes=0)  # type: ignore[arg-type]


class TestAdvertisedEncodings:
    def test_every_advertised_encoding_has_a_decoder(self):
        """Derived from the table, so this cannot drift — pinned anyway,
        because advertising zstd without a decoder is the bug it prevents."""
        table = getattr(APIRequest, "_APIRequest__content_encodings")

        for name in APIRequest.supported_encodings.split(", "):
            assert name in table
            assert table[name] is not table[""]

        assert APIRequest.supported_encodings == "gzip, deflate, br"
