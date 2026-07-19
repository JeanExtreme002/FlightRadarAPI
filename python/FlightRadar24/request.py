# -*- coding: utf-8 -*-

from typing import Dict, List, Optional, Union

import brotli
import json
import gzip

import cloudscraper
import requests.structures

from .errors import CloudflareError

# Shared session so Cloudflare cookies are reused across requests.
# FR24-specific headers are set at session level; cloudscraper manages
# user-agent, accept-encoding, sec-fetch-* to keep the Cloudflare
# challenge fingerprint consistent.
_session = cloudscraper.create_scraper(
    browser={"browser": "chrome", "platform": "windows", "mobile": False}
)
_session.headers.update({
    "origin": "https://www.flightradar24.com",
    "referer": "https://www.flightradar24.com/",
})


def reset_connections() -> None:
    """
    Drop the session's pooled keep-alive connections and its AWS load
    balancer affinity cookies, so the next request gets routed to a
    different backend node.

    FR24's endpoints sit behind an AWS ALB with cookie-based session
    stickiness (AWSALB/AWSALBCORS): once a request lands on a broken
    backend node (e.g. feed.js answering a stats-only body with zero
    flights), the affinity cookie pins every later request to that same
    node. Only these cookies are removed — others (e.g. Cloudflare
    clearance) must survive.
    """
    _session.close()

    jar = _session.cookies
    for cookie in list(jar):
        if cookie.name.startswith("AWSALB"):
            jar.clear(cookie.domain, cookie.path, cookie.name)


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

        request_method = _session.get if data is None else _session.post

        # Only pass headers that don't conflict with cloudscraper's own fingerprint.
        # Cloudflare flags accept:application/json (no text/html) as non-browser.
        # user-agent, accept, accept-encoding, accept-language, sec-fetch-* are all
        # managed by the session so the Cloudflare challenge fingerprint stays valid.
        _SAFE_HEADERS = {"cache-control", "content-type"}
        per_request_headers = {
            k: v for k, v in (headers or {}).items()
            if k.lower() in _SAFE_HEADERS
        } or None

        if params: url += "?" + "&".join(["{}={}".format(k, v) for k, v in params.items()])
        self.__response = request_method(url, headers=per_request_headers, cookies=cookies, data=data, timeout=timeout)

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
        content_type = self.__response.headers.get("Content-Type", "")

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
