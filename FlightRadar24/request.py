# -*- coding: utf-8 -*-

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

    def __init__(self, url, params = {}, headers = {}, data = None):

        self.url = url
        self.params = params
        self.headers = headers
        self.data = data

        if data is not None:
            self.__response = self.__post_request(url, data, headers)
        else:
            self.__response = self.__get_request(url, params, headers)

    def __params_to_string(self, params):

        return "&".join(["{}={}".format(k, v) for k, v in params.items()])

    def __get_request(self, url, params, headers):

        if params: url += "?" + self.__params_to_string(params)
        return requests.get(url, headers = headers)

    def __post_request(self, url, data, headers):

        return requests.post(url, data = data, headers = headers)

    def get_content(self):

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

    def get_content_encoding(self):

        return self.__response.headers.get("Content-Encoding", "")

    def get_content_type(self):

        return self.__response.headers["Content-Type"]

    def get_status_code(self):

        return self.__response.status_code

    def get_cookies(self):

        return self.__response.cookies.get_dict()

    def get_cookie(self, cookie):

        return self.__response.cookies.get(cookie)
