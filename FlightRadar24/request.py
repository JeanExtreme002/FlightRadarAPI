# -*- coding: utf-8 -*-

from requests.models import Response
from requests.structures import CaseInsensitiveDict
from typing import Dict, Optional, Union

import brotli
import json
import gzip
import requests


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
        data: Optional[Dict] = None,
        cookies: Optional[Dict] = None
    ):
        """
        Constructor of the APIRequest class.

        :param url: URL for the request
        :param params: params that will be inserted on the URL for the request
        :param headers: headers for the request
        :param data: data for the request. If "data" is None, request will be a GET. Otherwise, it will be a POST
        :param cookies: cookies for the request
        """
        self.url = url

        self.request_params = {
            "params": params,
            "headers": headers,
            "data": data,
            "cookies": cookies
        }

        request_method = requests.get if data is None else requests.post

        if params: url += "?" + "&".join(["{}={}".format(k, v) for k, v in params.items()])
        self.__response = request_method(url, headers = headers, cookies = cookies, data = data)

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
        if content_type == "application/json":
            return json.loads(content)

        return content

    def get_cookies(self) -> Dict:
        """
        Return the received cookies from the request.
        """
        return self.__response.cookies.get_dict()

    def get_headers(self) -> CaseInsensitiveDict:
        """
        Return the headers of the response.
        """
        return self.__response.headers

    def get_response_object(self) -> Response:
        """
        Return the received response object.
        """
        return self.__response

    def get_status_code(self) -> int:
        """
        Return the status code of the response.
        """
        return self.__response.status_code
