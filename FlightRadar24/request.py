# -*- coding: utf-8 -*-

import brotli
import json
import gzip
import requests
import aiohttp
import asyncio
dsn = "..."


class APIRequest(object):

    __content_encodings = {
        "": lambda x: x,
        "br": brotli.decompress,
        "gzip": gzip.decompress
    }
    

    def __init__(self, url, params = {}, headers = {}):

        self.url = url
        self.params = params
        self.headers = headers
    
    async def __params_to_string(self, params):

        return '&'.join(["{}={}".format(k, v) for k, v in params.items()])

    async def __send_request(self, url, params, headers):

        if params: url += "?" + await self.__params_to_string(params)
        async with aiohttp.ClientSession() as cs:
            async with cs.get(url, headers=headers) as r:
                return [await r.read(), r.status]




    async def get_content(self):
        content = self.__response.content
        content_encoding = await self.get_content_encoding()
        content_type = await self.get_content_type()

        # Try to decode the content.
        try: content = self.__content_encodings[content_encoding](content)
        except: pass

        # Return a dictionary if the content type is JSON.
        if content_type == "application/json":
            return json.loads(content)

        return content

    async def get_content_encoding(self):
        return self.__response.headers.get("Content-Encoding", "")

    async def get_content_type(self):

        return self.__response.headers["Content-Type"]

    async def get_status_code(self):
        return self.__response.status


    @classmethod
    async def main(cls, url, params = {}, headers = {}):
        self = cls(url, params, headers)
        self.__response = await self.__send_request(url, params, headers)
        return self.__response


