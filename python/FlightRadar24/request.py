# -*- coding: utf-8 -*-

from typing import Dict, List, Optional, Union

import brotli
import json
import gzip

import requests
import requests.structures

from .errors import CloudflareError


class APIRequest(object):
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
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: int = 30,
        data: Optional[Dict] = None,
        cookies: Optional[Dict] = None,
        exclude_status_codes: List[int] = list()
    ):
        """
        Constructor of the APIRequest class.

        :param url: URL for the request
        :param params: params that will be inserted on the URL for the request
        :param headers: headers for the request
        :param data: data for the request. If "data" is None, request will be a GET. Otherwise, it will be a POST
        :param cookies: cookies for the request
        :param exclude_status_codes: raise for status code except those on the excluded list
        """
        self.url = url

        self.request_params = {
            "params": params,
            "headers": headers,
            "timeout": timeout,
            "data": data,
            "cookies": cookies
        }

        request_method = requests.get if data is None else requests.post

        if params: url += "?" + "&".join(["{}={}".format(k, v) for k, v in params.items()])
        self.__response = request_method(url, headers=headers, cookies=cookies, data=data, timeout=timeout)

        if self.get_status_code() == 520:
            raise CloudflareError(
                message="An unexpected error has occurred. Perhaps you are making too many calls?",
                response=self.__response
            )

        if self.get_status_code() not in exclude_status_codes:
            self.__response.raise_for_status()

    def get_content(self) -> Union[Dict, bytes]:
        """
        Return the received content from the request.
        """
        content = self.__response.content

        content_encoding = self.__response.headers.get("Content-Encoding", "")
        content_type = self.__response.headers["Content-Type"]

        # Try to decode the content.
        try: content = self.__content_encodings[content_encoding](content)
        except Exception: pass

        # Return a dictionary if the content type is JSON.
        if "application/json" in content_type:
            return json.loads(content)

        return content

    def get_cookies(self) -> Dict:
        """
        Return the received cookies from the request.
        """
        return self.__response.cookies.get_dict()

    def get_headers(self) -> requests.structures.CaseInsensitiveDict:
        """
        Return the headers of the response.
        """
        return self.__response.headers

    def get_response_object(self) -> requests.models.Response:
        """
        Return the received response object.
        """
        return self.__response

    def get_status_code(self) -> int:
        """
        Return the status code of the response.
        """
        return self.__response.status_code
