# -*- coding: utf-8 -*-

import gzip
import json
import logging
import random
import time
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlencode

import brotli
from curl_cffi import requests
from curl_cffi.requests import Session

from .errors import CloudflareError

_logger = logging.getLogger(__name__)

DEFAULT_IMPERSONATE = "chrome136"


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
    Central HTTP client for the FlightRadar24 package.

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


class APIRequest:
    """
    Class to make requests to the FlightRadar24.
    """
    __content_encodings = {
        "": lambda x: x,
        "br": brotli.decompress,
        "gzip": gzip.decompress
    }

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
        """
        self.url = url

        if params: url += "?" + urlencode(params)

        if session is not None:
            request_method = session.get if data is None else session.post
            self.__response = request_method(url, headers=headers, data=data, timeout=timeout)
        else:
            request_method = requests.get if data is None else requests.post
            self.__response = request_method(
                url, headers=headers, data=data, timeout=timeout,
                impersonate=impersonate  # type: ignore[arg-type]
            )

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

    def get_content(self) -> Union[Dict, bytes]:
        """
        Return the received content from the request.
        """
        content = self.__response.content

        content_encoding = self.__response.headers.get("Content-Encoding", "")
        content_type = self.__response.headers.get("Content-Type", "")

        # Decompress the content if a known encoding was used; fall back to raw bytes otherwise.
        # curl_cffi may already decompress content automatically, so failures here usually mean
        # the bytes were already decoded by the transport layer — log and continue rather than
        # surfacing an error the caller cannot act on.
        decode = self.__content_encodings.get(content_encoding, self.__content_encodings[""])
        try:
            content = decode(content)
        except Exception as err:
            _logger.warning(
                "APIRequest.get_content: failed to decode Content-Encoding=%r for %s (%s). "
                "Assuming the transport already decompressed and returning raw bytes.",
                content_encoding, self.url, err,
            )

        # Return a dictionary if the content type is JSON.
        if "application/json" in content_type:
            return json.loads(content)

        return content

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
