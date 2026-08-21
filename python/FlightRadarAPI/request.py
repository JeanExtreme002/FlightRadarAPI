# -*- coding: utf-8 -*-

import json
import logging
import random
import time
import zlib
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlencode

import brotli
from curl_cffi import CurlECode, CurlOpt, requests
from curl_cffi.requests import Session

from .errors import CloudflareError, DecompressionLimitError

_logger = logging.getLogger(__name__)

DEFAULT_IMPERSONATE = "chrome136"

# A compressed body is trusted only as far as its expanded size: brotli reaches
# ratios high enough to exhaust memory from a few kilobytes on the wire.
#
# Enforcing that needs the compressed bytes, which means taking content decoding
# away from libcurl (see `_keep_body_encoded`): left to itself it expands the body
# before any of this code runs, and the only other way to intervene —
# `stream=True` — was measured to cost more than the bomb it stops: `timeout`
# degrades to a >=1 byte/sec liveness check, which alone rules it out, and the
# session stops reusing connections (the standalone path already opens one per
# call, so that second cost lands on the session path only).
# Owning the decoding is why `deflate` is implemented below rather than left to
# the transport: whatever `accept-encoding` advertises, this module must decode.
MAX_RESPONSE_BYTES = 64 * 1024 * 1024
_ZLIB_WBITS = 15         # zlib-wrapped deflate, as RFC 9110 specifies
_RAW_DEFLATE_WBITS = -15  # raw deflate, as many servers actually send
_GZIP_WBITS = 31  # 16 + MAX_WBITS: gzip wrapper rather than raw deflate
_GZIP_MAGIC = b"\x1f\x8b"


def _bound_download(session: Session, limit: int) -> None:
    """Have libcurl abort a response body larger than ``limit``.

    Bounds the bytes as received, which the post-hoc length check cannot: by
    the time it runs, libcurl has buffered the whole body. Aborts both when
    `Content-Length` announces the size and mid-transfer when it does not.
    """
    session.curl.setopt(CurlOpt.MAXFILESIZE_LARGE, limit)


def _keep_body_encoded(session: Session) -> None:
    """Stop libcurl decompressing this session's next response.

    libcurl decompresses transparently, which would expand a bomb before this
    module ever sees it. With decoding off the compressed bytes arrive intact
    and the helpers below can enforce a real budget. `Accept-Encoding` is still
    sent, so responses stay compressed on the wire.

    Applied per request, not once at construction: `Session.request` resets the
    handle, so an option set in the constructor survives the first call and
    silently lapses on every one after it. Setting it here also leaves
    curl_cffi's thread-local handles in place.
    """
    session.curl.setopt(CurlOpt.HTTP_CONTENT_DECODING, 0)


def _decompress_deflate(data: bytes, limit: int = MAX_RESPONSE_BYTES) -> bytes:
    """Inflate a deflate body in either shape it arrives in.

    RFC 9110 says zlib-wrapped; plenty of servers send raw. libcurl accepted
    both, so taking decoding over means accepting both too.
    """
    for wbits in (_ZLIB_WBITS, _RAW_DEFLATE_WBITS):
        decompressor = zlib.decompressobj(wbits)

        try:
            output = decompressor.decompress(data, limit + 1)
        except zlib.error:
            continue

        if len(output) > limit or decompressor.unconsumed_tail:
            raise DecompressionLimitError(
                f"deflate body expands past the {limit} byte decompression limit."
            )

        if decompressor.eof:
            # Raw deflate carries neither a header nor a checksum, so a body
            # that is not deflate at all can still inflate to plausible bytes;
            # requiring the whole input to be consumed is the only tell there
            # is. The zlib wrapper has an adler32 and validates itself, so
            # applying the same rule there would only reject a legitimate body
            # that arrived with trailing padding.
            if wbits == _RAW_DEFLATE_WBITS and decompressor.unused_data:
                continue

            return output

    raise zlib.error("body is not a complete deflate stream")


def _decompress_gzip(data: bytes, limit: int = MAX_RESPONSE_BYTES) -> bytes:
    """Inflate gzip bytes, refusing a body that expands past ``limit``.

    A short read must raise rather than return what arrived: the caller cannot
    tell truncated JSON from a malformed feed, and `get_content` treats a raised
    error as "the transport already decoded this" and hands back the raw bytes.
    """
    # Collected rather than concatenated: `output += ...` copies everything so
    # far on each member, which is quadratic and measured 50x slower on a
    # 500-member body. Joining also beats a bytearray, which pays one more
    # full copy converting back to bytes on the single-member path that
    # nearly every response takes.
    members = []
    decoded = 0
    remaining = data

    while remaining:
        # A new object per member: `Content-Encoding: gzip` may carry several,
        # and one decompressor stops at the first trailer.
        decompressor = zlib.decompressobj(_GZIP_WBITS)
        member = decompressor.decompress(remaining, limit + 1 - decoded)
        members.append(member)
        decoded += len(member)

        if decoded > limit or decompressor.unconsumed_tail:
            raise DecompressionLimitError(
                f"gzip body expands past the {limit} byte decompression limit."
            )

        if not decompressor.eof:
            raise zlib.error("gzip stream ended mid-member")

        # Another member only when the tail looks like one. Trailing padding is
        # not an error: libcurl stopped at the stream end and ignored it, and
        # the deflate helper tolerates the same thing.
        tail = decompressor.unused_data
        remaining = tail if tail.startswith(_GZIP_MAGIC) else b""

    return members[0] if len(members) == 1 else b"".join(members)


def _decompress_brotli(data: bytes, limit: int = MAX_RESPONSE_BYTES) -> bytes:
    """Decompress brotli bytes, refusing a body that expands past ``limit``.

    ``process`` takes a max-output argument, so the cap is enforced by the
    decompressor rather than checked after the fact: the cost tracks ``limit``
    rather than however far the body would have expanded.

    Pieces are collected and joined, as in the gzip helper. Growing a bytearray
    and converting it back pays two full copies of the output and measured 3x
    the decoded size at peak, against 1x here — the usual single-piece response
    is returned without being copied at all.
    """
    decompressor = brotli.Decompressor()
    pieces = []
    decoded = 0
    fed = False

    while not decompressor.is_finished():
        room = limit + 1 - decoded

        if room <= 0:
            raise DecompressionLimitError(
                f"brotli body expands past the {limit} byte decompression limit."
            )

        piece = decompressor.process(data if not fed else b"", room)
        fed = True
        pieces.append(piece)
        decoded += len(piece)

        if decoded > limit:
            raise DecompressionLimitError(
                f"brotli body expands past the {limit} byte decompression limit."
            )

        # No output left and still hungry: nothing more will come.
        if not piece and decompressor.can_accept_more_data():
            break

    # Same contract as the gzip helper: a partial body must not pass as whole.
    if not decompressor.is_finished():
        raise brotli.error("brotli stream ended mid-message")

    return pieces[0] if len(pieces) == 1 else b"".join(pieces)


class RetryPolicy:
    """
    Retry policy for transient errors (CloudflareError + curl_cffi network errors).

    :param max_attempts: total number of attempts including the first one (>= 1).
    :param base_delay: seconds for the first backoff sleep.
    :param max_delay: cap for the exponential backoff.
    :param jitter: random factor [0, jitter) added to each sleep.
    """

    def __init__(
        self,
        max_attempts: int = 1,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
        jitter: float = 0.5,
    ):
        if max_attempts < 1:
            raise ValueError("max_attempts must be >= 1")
        if base_delay < 0 or max_delay < 0 or jitter < 0:
            raise ValueError("base_delay, max_delay and jitter must all be >= 0")
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter

    def sleep_for(self, attempt_index: int) -> float:
        """Return the backoff (in seconds) for the given 0-based attempt index."""
        delay = min(self.base_delay * (2 ** attempt_index), self.max_delay)
        return delay + random.uniform(0, self.jitter)


def _run_with_retry(fn, retry: Optional[RetryPolicy]):
    """Execute ``fn()`` with retry on CloudflareError / transient network errors."""
    if retry is None or retry.max_attempts <= 1:
        return fn()

    last_error: Optional[Exception] = None
    for attempt in range(retry.max_attempts):
        try:
            return fn()
        except CloudflareError as err:
            last_error = err
        except requests.errors.RequestsError as err:  # type: ignore[attr-defined]
            last_error = err
        if attempt < retry.max_attempts - 1:
            time.sleep(retry.sleep_for(attempt))
    # Defensive: with max_attempts > 1, last_error is always populated by the
    # time we reach here, but don't rely on `assert` because it is stripped by
    # `python -O` and would turn into `raise None` -> TypeError.
    if last_error is None:
        raise RuntimeError("retry loop exited without success or captured error")
    raise last_error


class APIClient:
    """
    Central HTTP client for the FlightRadarAPI package.

    Owns the persistent session (cookie jar, TLS fingerprint, future bypass logic)
    so that the rest of the codebase never has to deal with those concerns directly.

    :param impersonate: curl_cffi browser profile to mimic. Defaults to
        ``DEFAULT_IMPERSONATE`` (currently ``"chrome136"``). When FR24 updates its
        Cloudflare bot mitigation, pass a newer profile (e.g. ``"chrome137"``,
        ``"chrome138"``) without waiting for a library release.
    """

    def __init__(
        self,
        impersonate: str = DEFAULT_IMPERSONATE,
        retry: Optional[RetryPolicy] = None,
    ) -> None:
        self.__impersonate = impersonate
        self.__retry = retry
        self.__session: Session = Session(impersonate=impersonate)  # type: ignore[arg-type]

    def request(self, url: str, **kwargs) -> "APIRequest":
        """Make a request through the shared session."""
        return _run_with_retry(
            lambda: APIRequest(url, session=self.__session, **kwargs),
            self.__retry,
        )

    def request_standalone(self, url: str, **kwargs) -> "APIRequest":
        """Make a stateless request with no shared session (safe to call from threads).

        The TLS impersonation profile is inherited from this client so that
        thread-pool fan-outs still mimic the same browser as the session.
        """
        return _run_with_retry(
            lambda: APIRequest(url, impersonate=self.__impersonate, **kwargs),
            self.__retry,
        )

    def get_cookie(self, name: str) -> Optional[str]:
        """Return the value of a stored cookie by name."""
        return self.__session.cookies.get(name)

    def clear_cookies(self) -> None:
        """Clear all cookies from the session."""
        self.__session.cookies.clear()

    def delete_cookie(self, name: str) -> None:
        """Drop a single cookie, leaving the rest of the jar intact.

        Sheds load-balancer stickiness without discarding the login session,
        which lives in the same jar.
        """
        try:
            del self.__session.cookies[name]
        except KeyError:
            pass


class APIRequest:
    """
    Class to make requests to the FlightRadar24.
    """
    # Ordered as Chrome sends them, since this is what `Accept-Encoding`
    # advertises. "" and "identity" mean "no encoding", not a decoder.
    __content_encodings = {
        "": lambda data, limit: data,
        "identity": lambda data, limit: data,
        "gzip": _decompress_gzip,
        "deflate": _decompress_deflate,
        "br": _decompress_brotli,
    }

    #: Advertised on every request, because taking decoding from libcurl means
    #: only asking for what can be decoded here. curl_cffi's impersonation
    #: otherwise defaults to "gzip, deflate, br, zstd", and a zstd reply would
    #: arrive as bytes nothing here can read. Derived rather than written out,
    #: so advertising an encoding without a decoder is not expressible.
    supported_encodings = ", ".join(
        name for name in __content_encodings if name not in ("", "identity")
    )

    def __init__(
        self,
        url: str,
        *,
        session: Optional[Session] = None,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: int = 30,
        data: Optional[Dict] = None,
        allowed_error_codes: Optional[List[int]] = None,
        impersonate: str = DEFAULT_IMPERSONATE,
        max_response_bytes: int = MAX_RESPONSE_BYTES,
        max_download_bytes: Optional[int] = None,
    ):
        """
        Constructor of the APIRequest class.

        :param url: URL for the request
        :param session: session to reuse across requests; handles cookies automatically
        :param params: params that will be inserted on the URL for the request
        :param headers: headers for the request
        :param data: data for the request. If "data" is None, request will be a GET. Otherwise, it will be a POST
        :param allowed_error_codes: status codes that should not raise an error
        :param impersonate: curl_cffi browser profile (only used when no session is provided)
        :param max_response_bytes: reject a body that expands past this many bytes
        :param max_download_bytes: reject a body larger than this on the wire.
            Defaults to ``max_response_bytes``. Separate because compression can
            grow incompressible data, so a body that expands to just under the
            budget may still arrive slightly over it.
        """
        if max_response_bytes < 1:
            raise ValueError("max_response_bytes must be >= 1")

        if max_download_bytes is None:
            max_download_bytes = max_response_bytes
        elif max_download_bytes < 1:
            raise ValueError("max_download_bytes must be >= 1")

        self.url = url
        self.__max_response_bytes = max_response_bytes
        headers = self.__with_supported_encodings(headers)

        if params: url += "?" + urlencode(params)

        try:
            if session is not None:
                _keep_body_encoded(session)
                _bound_download(session, max_download_bytes)
                request_method = session.get if data is None else session.post
                self.__response = request_method(url, headers=headers, data=data, timeout=timeout)
            else:
                # A throwaway session rather than the module-level helpers, whose
                # internal handle this cannot reach.
                with Session(impersonate=impersonate) as standalone:  # type: ignore[arg-type]
                    _keep_body_encoded(standalone)
                    _bound_download(standalone, max_download_bytes)
                    request_method = standalone.get if data is None else standalone.post
                    self.__response = request_method(url, headers=headers, data=data, timeout=timeout)
        except requests.errors.RequestsError as err:  # type: ignore[attr-defined]
            # Not a transient failure, so it must not reach the retry policy as one.
            if getattr(err, "code", None) == CurlECode.FILESIZE_EXCEEDED:
                raise DecompressionLimitError(
                    f"Response body from {self.url} is larger than the "
                    f"{max_download_bytes} byte download limit."
                ) from err
            raise

        received = self.__response.content

        # Three checks guard the size, each covering what the others cannot:
        # MAXFILESIZE_LARGE stops the download at the socket, the decoders stop
        # an expansion as it happens, and this one is the backstop for a
        # transport that honours neither. Unreachable today, kept because it
        # costs one comparison.
        if len(received) > max_download_bytes:
            raise DecompressionLimitError(
                f"Response body from {self.url} is {len(received)} bytes, "
                f"past the {max_download_bytes} byte download limit."
            )

        self.__content = self.__decode_body(received)

        # The decoders enforce the budget as they expand, but identity bodies
        # and encodings with no decoder never reach one. Checked here so the
        # budget means the same thing whatever arrived.
        if len(self.__content) > max_response_bytes:
            raise DecompressionLimitError(
                f"Response body from {self.url} is {len(self.__content)} bytes, "
                f"past the {max_response_bytes} byte limit."
            )

        # `get_response_object()` and `CloudflareError.response` are public, and
        # a challenge page is the first thing anyone reads when debugging a
        # block. Since libcurl no longer decodes, hand them the decoded body.
        self.__response.content = self.__content

        # Cloudflare detection only when the caller did not opt-in to this status code.
        # `getAirlineLogo`/`getCountryFlag` allow 403 to mean "asset not found" on the CDN.
        if (self.get_status_code() not in (allowed_error_codes or [])
                and self.__is_cloudflare_block()):
            raise CloudflareError(
                message="Blocked by Cloudflare. Perhaps you are making too many calls, "
                        "or the TLS impersonation needs to be updated.",
                response=self.__response
            )

        if self.get_status_code() not in (allowed_error_codes or []):
            self.__response.raise_for_status()

    @classmethod
    def __with_supported_encodings(cls, headers: Optional[Dict]) -> Optional[Dict]:
        """Ask only for encodings this class can decode."""
        if headers and any(name.lower() == "accept-encoding" for name in headers):
            return headers

        merged = dict(headers or {})
        merged["accept-encoding"] = cls.supported_encodings
        return merged

    def __is_cloudflare_block(self) -> bool:
        """
        Detect Cloudflare-level blocks.

        FR24 fronts the public site with Cloudflare, so a `Server: cloudflare`
        header is present on *every* response — including legitimate 403s from
        the FR24 origin (e.g. premium-only endpoints accessed by a free
        account). To avoid false positives we rely on signals that Cloudflare
        sets only when its own bot-management / challenge actually took
        action:

        - HTTP 520 (Cloudflare's "unknown error from origin").
        - HTTP 403 with the `cf-mitigated` header set — Cloudflare adds this
          specifically when it (not the origin) decided to block the request.
        """
        status = self.get_status_code()
        if status == 520:
            return True
        if status != 403:
            return False
        return bool(self.__response.headers.get("cf-mitigated"))

    def __decode_body(self, content: bytes) -> bytes:
        """Undo the `Content-Encoding` this response arrived with.

        The header may stack encodings ("gzip, br" means gzip then brotli), so
        they are undone in reverse. Values are case-insensitive and may carry
        whitespace, so each token is normalised: an exact match would send
        `GZIP` down the identity path and return compressed bytes as content.
        A token with no decoder warns rather than passing silently, since
        nothing downstream can act on the result.
        """
        content_encoding = self.__response.headers.get("Content-Encoding", "") or ""
        tokens = [token.strip().lower() for token in content_encoding.split(",")]
        applied = [token for token in tokens if token and token != "identity"]

        if not applied:
            return content

        decoders = []

        for token in applied:
            decode = self.__content_encodings.get(token)

            if decode is None:
                _logger.warning(
                    "APIRequest: no decoder for Content-Encoding=%r on %s. Returning the body "
                    "as received, which callers will not be able to read.",
                    content_encoding, self.url,
                )
                return content

            decoders.append(decode)

        received = content
        failed_at = applied[-1]

        try:
            for token, decode in zip(reversed(applied), reversed(decoders)):
                failed_at = token
                content = decode(content, self.__max_response_bytes)

            return content
        except DecompressionLimitError:
            raise
        except Exception as err:
            # Back to the bytes as received. A chain that failed halfway leaves
            # a half-decoded intermediate, and the recovery below is a claim
            # about the body that arrived, not about a partial result.
            content = received
            # Reached when the body is not encoded the way the header claims —
            # most often a transport that decoded it after all. Decided by the
            # body, not the header: undecodable text is genuinely broken and
            # must warn, while binary bodies carry no such tell. Nothing here
            # may raise, or it would replace `err` with its own failure.
            content_type = self.__response.headers.get("Content-Type", "")

            if not isinstance(content, bytes):
                transport_decoded = True
            elif content_type.startswith(("application/json", "text/")):
                try:
                    content.decode("utf-8")
                    transport_decoded = True
                except UnicodeDecodeError:
                    transport_decoded = False
            else:
                corrupt_gzip = failed_at == "gzip" and content.startswith(_GZIP_MAGIC)
                transport_decoded = failed_at in ("gzip", "br", "deflate") and not corrupt_gzip

            _logger.log(
                logging.DEBUG if transport_decoded else logging.WARNING,
                "APIRequest: failed to decode Content-Encoding=%r for %s (%s). "
                "Assuming the body arrived already decoded and returning it as-is.",
                content_encoding, self.url, err,
            )
            return content

    def get_content(self) -> Union[Dict, bytes]:
        """
        Return the received content from the request.
        """
        content_type = self.__response.headers.get("Content-Type", "")

        # Return a dictionary if the content type is JSON.
        if "application/json" in content_type:
            return json.loads(self.__content)

        return self.__content

    def get_json_content(self) -> Dict[str, Any]:
        """
        Return the response content as a parsed JSON dictionary.
        """
        content = self.get_content()
        if not isinstance(content, dict):
            raise ValueError(f"Expected JSON response from {self.url}, got bytes")
        return content

    def get_bytes_content(self) -> bytes:
        """
        Return the response content as raw bytes.
        """
        content = self.get_content()
        if not isinstance(content, bytes):
            raise ValueError(f"Expected bytes response from {self.url}, got JSON")
        return content

    def get_headers(self) -> Any:
        """
        Return the headers of the response.
        """
        return self.__response.headers

    def get_response_object(self) -> Any:
        """
        Return the received response object.
        """
        return self.__response

    def get_status_code(self) -> int:
        """
        Return the status code of the response.
        """
        return self.__response.status_code
