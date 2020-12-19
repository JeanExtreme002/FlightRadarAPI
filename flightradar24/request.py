# -*- coding: utf-8 -*-

import brotli
import json
import gzip
import requests

class APIRequest(object):

    content_encodings = {
        "br": brotli.decompress,
        "gzip": gzip.decompress
    }

    def __init__(self, url, params = {}, headers = {}):

        self.url = url
        self.params = params
        self.headers = headers

        self.__response = self.__send_request(url, params, headers)

    def __decode_response(self, response):

        try:
            content = json.loads(response.content)

        except json.decoder.JSONDecodeError:
            content = content_encodings[response.headers["Content-Encoding"]](response.content)
            content = json.loads(content)

        finally:
            return content

    def __params_to_string(self, params):

        return '&'.join(["{}={}".format(k, v) for k, v in params.items()])

    def __send_request(self, url, params, headers):

        if params: url += "?" + self.__params_to_string(params)
        return requests.get(url, headers = headers)

    def get_response(self):

        return self.__decode_response(self.__response)

    def get_status_code(self):

        return self.__response.status_code
