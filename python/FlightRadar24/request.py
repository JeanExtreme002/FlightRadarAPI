# -*- coding: utf-8 -*-

import gzip
import json
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlencode

import brotli
from curl_cffi import requests
from curl_cffi.requests import Session

from .errors import CloudflareError

_IMPERSONATE = "chrome136"


class APIClient:
    """
    Central HTTP client for the FlightRadar24 package.

    Owns the persistent session (cookie jar, TLS fingerprint, future bypass logic)
    so that the rest of the codebase never has to deal with those concerns directly.
    """

    def __init__(self) -> None:
        self.__session: Session = Session(impersonate=_IMPERSONATE)  # type: ignore[arg-type]

    def request(self, url: str, **kwargs) -> "APIRequest":
        """Make a request through the shared session."""
        return APIRequest(url, session=self.__session, **kwargs)

    @staticmethod
    def request_standalone(url: str, **kwargs) -> "APIRequest":
        """Make a stateless request with no shared session (safe to call from threads)."""
        return APIRequest(url, **kwargs)

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
        allowed_error_codes: Optional[List[int]] = None
    ):
        """
        Constructor of the APIRequest class.

        :param url: URL for the request
        :param session: session to reuse across requests; handles cookies automatically
        :param params: params that will be inserted on the URL for the request
        :param headers: headers for the request
        :param data: data for the request. If "data" is None, request will be a GET. Otherwise, it will be a POST
        :param allowed_error_codes: status codes that should not raise an error
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
                impersonate=_IMPERSONATE  # type: ignore[arg-type]
            )

        if self.get_status_code() == 520:
            raise CloudflareError(
                message="An unexpected error has occurred. Perhaps you are making too many calls?",
                response=self.__response
            )

        if self.get_status_code() not in (allowed_error_codes or []):
            self.__response.raise_for_status()

    def get_content(self) -> Union[Dict, bytes]:
        """
        Return the received content from the request.
        """
        content = self.__response.content

        content_encoding = self.__response.headers.get("Content-Encoding", "")
        content_type = self.__response.headers.get("Content-Type", "")

        # Decompress the content if a known encoding was used; fall back to raw bytes otherwise.
        # curl_cffi may already decompress content automatically — ignore decompression failures.
        decode = self.__content_encodings.get(content_encoding, self.__content_encodings[""])
        try:
            content = decode(content)
        except Exception:
            pass

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
