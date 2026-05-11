# -*- coding: utf-8 -*-

import gzip
import json
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlencode

import brotli
from curl_cffi import requests

from .errors import CloudflareError

_IMPERSONATE = "chrome136"


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
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: int = 30,
        data: Optional[Dict] = None,
        cookies: Optional[Dict] = None,
        allowed_error_codes: Optional[List[int]] = None
    ):
        """
        Constructor of the APIRequest class.

        :param url: URL for the request
        :param params: params that will be inserted on the URL for the request
        :param headers: headers for the request
        :param data: data for the request. If "data" is None, request will be a GET. Otherwise, it will be a POST
        :param cookies: cookies for the request
        :param allowed_error_codes: status codes that should not raise an error
        """
        self.url = url

        request_method = requests.get if data is None else requests.post

        if params: url += "?" + urlencode(params)
        self.__response = request_method(
            url, headers=headers, cookies=cookies, data=data, timeout=timeout,
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

    def get_cookies(self) -> Dict:
        """
        Return the received cookies from the request.
        """
        return self.__response.cookies.get_dict()

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
