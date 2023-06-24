# -*- coding: utf-8 -*-

from typing import Any, Dict, Union
import brotli
import json
import gzip
import requests


class APIRequest(object):

    __content_encodings = {
        "": lambda x: x,
        "br": brotli.decompress,
        "gzip": gzip.decompress
    }

    def __init__(self, url, params = {}, headers = {}, data = None, cookies = None):

        self.url = url
        self.params = params
        self.headers = headers
        self.data = data
        self.cookies = cookies

        if data is None:
            if params: url += "?" + "&".join(["{}={}".format(k, v) for k, v in params.items()])
            self.__response = requests.get(url, headers = headers, cookies = cookies)
        else:
            self.__response = requests.post(url, headers = headers, cookies = cookies, data = data)

    def get_content(self) -> Union[Dict, bytes]:
        content = self.__response.content
        content_encoding = self.get_content_encoding()
        content_type = self.get_content_type()

        # Try to decode the content.
        try: content = self.__content_encodings[content_encoding](content)
        except: pass

        # Return a dictionary if the content type is JSON.
        if content_type == "application/json":
            return json.loads(content)

        return content

    def get_content_encoding(self) -> str:
        return self.__response.headers.get("Content-Encoding", "")

    def get_content_type(self):
        return self.__response.headers["Content-Type"]

    def get_status_code(self) -> int:
        return self.__response.status_code

    def get_cookies(self) -> Dict:
        return self.__response.cookies.get_dict()

    def get_cookie(self, cookie: str) -> Any:
        return self.__response.cookies.get(cookie)
