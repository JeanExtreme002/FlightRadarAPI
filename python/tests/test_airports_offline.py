# -*- coding: utf-8 -*-
"""Offline tests for the page crawl behind ``get_airports()``.

FR24 lists airports one Inertia page per country, and per state for the largest
countries. These tests pin down which pages the crawl asks for and how it reads
them, against the bundled fixtures, so the PR gate covers the orchestration
without reaching FR24.
"""

import json
import os
from typing import Any, Dict, List, Optional, Union

from FlightRadarAPI import Countries, FlightRadar24API
from FlightRadarAPI.core import Core

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _load(name: str) -> bytes:
    with open(os.path.join(FIXTURES, name), "rb") as f:
        return f.read()


# Every page the fixtures model, by the path FR24 serves it at.
PAGES: Dict[str, str] = {
    "/data/airports": "airports_index.html",
    "/data/airports/uruguay": "airports_country.json",
    "/data/airports/brazil": "airports_country_states.json",
    "/data/airports/brazil/sp": "airports_state_sp.json",
    "/data/airports/brazil/rj": "airports_state_rj.json",
    "/data/airports/myanmar-burma": "airports_country.html",
}


class _FakeResponse:
    def __init__(self, status_code: int, content: Union[Dict[str, Any], bytes]) -> None:
        self._status_code = status_code
        self._content = content

    def get_status_code(self) -> int:
        return self._status_code

    def get_content(self) -> Union[Dict[str, Any], bytes]:
        return self._content

    def get_bytes_content(self) -> bytes:
        if not isinstance(self._content, bytes):
            raise ValueError("Expected bytes response, got JSON")
        return self._content


class _FakeClient:
    """Serves the fixture pages the way FR24 does.

    A request carrying the inertia headers gets the page JSON when the version
    matches and a 409 otherwise; a plain request gets the HTML. The index page
    only exists as HTML, like the real one as the crawl fetches it.
    """

    def __init__(self, version: Optional[str] = "919b94d2a33f365a34f99828f6eeec6a") -> None:
        self.version = version
        self.calls: List[Dict[str, Any]] = []

    def _serve(self, url: str, **kwargs: Any) -> _FakeResponse:
        self.calls.append({"url": url, **kwargs})
        path = url.replace(Core.flightradar_base_url, "")
        fixture = PAGES.get(path, "airports_index.html")
        headers = kwargs.get("headers") or {}

        if headers.get("x-inertia") == "true":
            if headers.get("x-inertia-version") != self.version:
                assert 409 in (kwargs.get("allowed_error_codes") or []), "a 409 must not raise"
                return _FakeResponse(409, b"")
            page = json.loads(_load(fixture)) if fixture.endswith(".json") else _page_of(_load(fixture))
            return _FakeResponse(200, page)

        if fixture.endswith(".json"):
            fixture = fixture.replace(".json", ".html")
            if not os.path.exists(os.path.join(FIXTURES, fixture)):
                fixture = "airports_country.html"
        return _FakeResponse(200, _load(fixture))

    request = _serve
    request_standalone = _serve


def _page_of(html: bytes) -> Dict[str, Any]:
    from FlightRadarAPI.parsers import parse_inertia_page
    page = parse_inertia_page(html)
    assert page is not None
    return page


def _api(client: _FakeClient) -> FlightRadar24API:
    api = FlightRadar24API()
    # Name-mangled private attribute -- set it the way Python stores it.
    api._FlightRadar24API__client = client  # type: ignore[attr-defined]
    return api


def _paths(client: _FakeClient) -> List[str]:
    return [call["url"].replace(Core.flightradar_base_url, "") for call in client.calls]


def test_get_airports_crawls_the_country_then_its_states():
    client = _FakeClient()

    airports = _api(client).get_airports([Countries.BRAZIL])

    assert [a.iata for a in airports] == ["GIG", "GRU", "CGH"]
    assert {a.country for a in airports} == {"Brazil"}
    assert _paths(client) == ["/data/airports", "/data/airports/brazil", "/data/airports/brazil/rj", "/data/airports/brazil/sp"]


def test_get_airports_asks_for_the_page_json_with_the_index_version():
    client = _FakeClient()

    _api(client).get_airports(Countries.URUGUAY)

    index, country = client.calls
    assert "x-inertia" not in index["headers"]
    assert country["headers"]["x-inertia"] == "true"
    assert country["headers"]["x-inertia-version"] == "919b94d2a33f365a34f99828f6eeec6a"


def test_get_airports_falls_back_to_html_when_the_assets_were_redeployed():
    client = _FakeClient(version="something-newer")

    airports = _api(client).get_airports(["uruguay"])

    # The index answered with a stale version, the JSON request got a 409 and
    # the HTML page was read instead.
    assert len(airports) == 1
    assert _paths(client) == ["/data/airports", "/data/airports/uruguay", "/data/airports/uruguay"]
    assert client.calls[2]["headers"] == Core.html_headers


def test_get_airports_without_countries_walks_the_whole_index():
    client = _FakeClient()

    airports = _api(client).get_airports()

    assert [a.iata for a in airports] == ["GIG", "GRU", "CGH", "RGN", "CYR", "MVD"]
    assert _paths(client) == [
        "/data/airports",
        "/data/airports/brazil", "/data/airports/myanmar-burma", "/data/airports/uruguay",
        "/data/airports/brazil/rj", "/data/airports/brazil/sp",
    ]


def test_get_airports_accepts_mixed_spellings_and_drops_repeats():
    client = _FakeClient()

    airports = _api(client).get_airports(["Uruguay", Countries.URUGUAY, "uruguay"])

    assert [a.iata for a in airports] == ["CYR", "MVD"]
    assert _paths(client) == ["/data/airports", "/data/airports/uruguay"]


def test_get_airports_with_an_empty_filter_makes_no_request():
    client = _FakeClient()

    assert _api(client).get_airports([]) == []
    assert _api(client).get_airports(iter([])) == []
    assert client.calls == []


def test_get_airports_unknown_country_returns_nothing_and_warns(caplog):
    client = _FakeClient()

    with caplog.at_level("WARNING", logger="FlightRadarAPI.api"):
        airports = _api(client).get_airports(["atlantis"])

    assert airports == []
    assert "no airports found for atlantis" in caplog.text
