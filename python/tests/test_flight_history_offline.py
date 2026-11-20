# -*- coding: utf-8 -*-
"""Offline tests for ``get_flight_history()``, against canned FR24 answers."""

from typing import Any, Dict, List, Optional

import pytest

from FlightRadarAPI import FlightRadar24API
from FlightRadarAPI.core import Core

HISTORY = {"result": {"response": {
    "item": {"current": 1, "total": None, "limit": 100},
    "page": {"current": 1, "more": False, "total": None},
    "data": [{
        "identification": {"id": "42a4afc2", "number": {"default": "SQ306"}},
        "status": {"text": "Landed 07:52"},
        "aircraft": {"model": {"code": "A359"}, "registration": "9V-SJD"},
        "airport": {"origin": {"code": {"iata": "SIN"}}, "destination": {"code": {"iata": "LHR"}}},
        "time": {"scheduled": {"departure": 1795077000, "arrival": 1795129200}},
    }],
}}}


def _bad_request(parameters: Dict[str, Any]) -> Dict[str, Any]:
    return {"errors": {"message": "Invalid parameters", "errors": {"parameters": parameters}}}


class _FakeResponse:
    def __init__(self, status_code: int, content: Dict[str, Any]) -> None:
        self._status_code = status_code
        self._content = content

    def get_status_code(self) -> int:
        return self._status_code

    def get_json_content(self) -> Dict[str, Any]:
        return self._content


class _FakeClient:
    def __init__(self, status_code: int = 200, content: Optional[Dict[str, Any]] = None) -> None:
        self.status_code = status_code
        self.content = content if content is not None else HISTORY
        self.calls: List[Dict[str, Any]] = []

    def request(self, url: str, **kwargs: Any) -> _FakeResponse:
        self.calls.append({"url": url, **kwargs})
        return _FakeResponse(self.status_code, self.content)

    def get_cookie(self, name: str) -> Optional[str]:
        return "session-token" if name == "_frPl" else None


def _api(client: _FakeClient, logged_in: bool = False) -> FlightRadar24API:
    api = FlightRadar24API()
    # Name-mangled private attributes -- set them the way Python stores them.
    api._FlightRadar24API__client = client  # type: ignore[attr-defined]
    if logged_in:
        api._FlightRadar24API__login_data = {"userData": {}}  # type: ignore[attr-defined]
    return api


def test_get_flight_history_returns_the_response_block():
    client = _FakeClient()

    history = _api(client).get_flight_history("SQ306", limit=10, page=2)

    assert history["data"][0]["identification"]["id"] == "42a4afc2"
    assert history["page"]["more"] is False

    call, = client.calls
    assert call["url"] == Core.flight_list_url
    assert call["params"] == {"query": "SQ306", "fetchBy": "flight", "limit": 10, "page": 2}


def test_get_flight_history_always_returns_a_list_of_flights():
    for response in ({"data": None}, {"aircraftInfo": None}):
        client = _FakeClient(content={"result": {"response": response}})

        assert _api(client).get_flight_history("ZZ9999")["data"] == []


def test_get_flight_history_sends_the_session_token_when_logged_in():
    client = _FakeClient()

    _api(client, logged_in=True).get_flight_history("SQ306")

    assert client.calls[0]["params"]["token"] == "session-token"


def test_get_flight_history_reports_a_limit_out_of_range():
    client = _FakeClient(400, _bad_request({"limit": {"notBetween": "The input is not between '1' and '100'"}}))

    with pytest.raises(ValueError, match="between '1' and '100'"):
        _api(client).get_flight_history("SQ306", limit=500)


def test_get_flight_history_reports_an_invalid_number():
    client = _FakeClient(400, _bad_request({"query": {"stringLengthTooShort": "less than 3 characters"}}))

    with pytest.raises(ValueError, match="'S'"):
        _api(client).get_flight_history("S")
