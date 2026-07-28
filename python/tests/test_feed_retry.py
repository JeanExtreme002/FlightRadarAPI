# -*- coding: utf-8 -*-
"""Offline tests for the degraded-live-feed recovery in ``get_flights()``.

A degraded FR24 feed backend answers 200 with a well-formed envelope but zero
flight entries, and the ``AWSALB`` cookie pins the session to it. These tests
pin down when ``get_flights()`` retries and when it must not, so the PR gate
keeps guarding the behaviour while FR24 is healthy.
"""

from typing import Any, Dict, List

from FlightRadarAPI import FlightRadar24API

# One real feed row, trimmed to the positional fields Flight actually reads.
FLIGHT_ROW = [
    "ABC123", -23.43, -46.47, 90, 35000, 450, "1234", "", "B738", "PR-XYZ",
    1700000000, "GRU", "GIG", "G31234", 0, 0, "GLO1234", 0, "GLO",
]

DEGRADED_FEED: Dict[str, Any] = {
    "full_count": 22684,
    "version": 4,
    "stats": {"total": {"ads-b": 18541}, "visible": {"ads-b": 0}},
}

HEALTHY_FEED: Dict[str, Any] = {
    "full_count": 24560,
    "version": 4,
    "3f6a31cd": FLIGHT_ROW,
    "40ae422e": FLIGHT_ROW,
}

IDLE_FEED: Dict[str, Any] = {"full_count": 0, "version": 4}


class _FakeResponse:
    """Stand-in for ``APIRequest``; only the JSON body is ever read."""

    def __init__(self, payload: Dict[str, Any]) -> None:
        self._payload = payload

    def get_json_content(self) -> Dict[str, Any]:
        return self._payload


class _FakeClient:
    """Replays ``responses`` in order and records dropped cookies.

    The final response repeats once the list is exhausted, so a single-item
    list models an upstream that never recovers.
    """

    def __init__(self, responses: List[Dict[str, Any]]) -> None:
        self._responses = responses
        self.calls: List[Dict[str, Any]] = []
        self.deleted: List[str] = []

    def request(self, url: str, **kwargs: Any) -> _FakeResponse:
        self.calls.append({"url": url, **kwargs})
        index = min(len(self.calls) - 1, len(self._responses) - 1)
        return _FakeResponse(self._responses[index])

    def delete_cookie(self, name: str) -> None:
        self.deleted.append(name)


def _api_with_feed_responses(responses: List[Dict[str, Any]]):
    api = FlightRadar24API()
    client = _FakeClient(responses)
    # Name-mangled private attribute -- set it the way Python stores it.
    api._FlightRadar24API__client = client  # type: ignore[attr-defined]
    return api, client


class TestDegradedFeedRecovery:
    def test_retries_empty_feed_and_returns_healthy_flights(self):
        api, client = _api_with_feed_responses([DEGRADED_FEED, HEALTHY_FEED])

        flights = api.get_flights()

        assert len(flights) == 2
        assert len(client.calls) == 2
        # Without this the balancer routes the retry back to the same backend.
        assert "AWSALB" in client.deleted
        assert "AWSALBCORS" in client.deleted

    def test_gives_up_and_returns_empty_when_feed_never_recovers(self):
        api, client = _api_with_feed_responses([DEGRADED_FEED])

        flights = api.get_flights()

        assert flights == []
        # A permanently degraded upstream must not loop forever.
        assert 1 < len(client.calls) <= 6

    def test_does_not_retry_when_nothing_is_tracked(self):
        api, client = _api_with_feed_responses([IDLE_FEED])

        flights = api.get_flights()

        assert flights == []
        assert len(client.calls) == 1
        assert client.deleted == []

    def test_does_not_retry_healthy_first_response(self):
        api, client = _api_with_feed_responses([HEALTHY_FEED])

        flights = api.get_flights()

        assert len(flights) == 2
        assert len(client.calls) == 1
        assert client.deleted == []

    def test_preserves_caller_filters_across_retries(self):
        api, client = _api_with_feed_responses(
            [DEGRADED_FEED, DEGRADED_FEED, HEALTHY_FEED]
        )

        api.get_flights("GLO", "75,3,-180,-52")

        assert len(client.calls) == 3
        for call in client.calls:
            assert call["params"]["airline"] == "GLO"
            assert call["params"]["bounds"] == "75,3,-180,-52"


class TestDeleteCookie:
    def test_drops_one_cookie_and_keeps_the_rest(self):
        from FlightRadarAPI.request import APIClient

        client = APIClient()
        session = client._APIClient__session  # type: ignore[attr-defined]
        session.cookies.set("AWSALB", "sticky")
        session.cookies.set("_frPl", "login-token")

        client.delete_cookie("AWSALB")

        assert client.get_cookie("AWSALB") is None
        # Shedding stickiness must not log the user out.
        assert client.get_cookie("_frPl") == "login-token"

    def test_is_a_no_op_for_an_absent_cookie(self):
        from FlightRadarAPI.request import APIClient

        client = APIClient()
        client.delete_cookie("AWSALB")  # must not raise
