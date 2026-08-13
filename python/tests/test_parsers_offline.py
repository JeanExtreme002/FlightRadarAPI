# -*- coding: utf-8 -*-
"""Offline parser tests against bundled fixtures.

These tests run with no network access and exist specifically so that PRs
can be gated on the parser logic without depending on FR24 being reachable
or its payloads being stable. When FR24 changes a page or feed,
update the fixtures (re-saving a real response is fine) — the assertions here
guard the parser's invariants, not byte-for-byte equality with production.
"""

import json
import math
import os

import pytest

from FlightRadarAPI.parsers import country_to_slug, parse_airlines_html, parse_airports_json

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

# Every case here caught a real bug or pins a stated invariant. Keep it in step
# with the same list in nodejs/tests/testParsersOffline.js: the two ports have
# drifted apart on exactly these inputs before.
NUMERIC_CASES = [
    ("whitespace", " ", None),
    ("an array holding a number", [43], None),
    ("a coordinate with a hemisphere suffix", "43.30 N", None),
    ("an exponent overflowing a double", "1e999", None),
    ("400 plain digits", "1" * 400, None),
    ("a whole number as a string", "2436", 2436),
    ("a negative decimal", "-23.4", -23.4),
    ("a genuine zero", 0, 0),
]


def _load(name: str) -> bytes:
    with open(os.path.join(FIXTURES, name), "rb") as f:
        return f.read()


# --- parse_airlines_html ---

def test_parse_airlines_html_extracts_known_rows():
    airlines = parse_airlines_html(_load("airlines.html"))
    names = [a["Name"] for a in airlines]
    assert "LATAM Airlines" in names
    assert "Gol" in names
    assert "Delta Air Lines" in names


def test_parse_airlines_html_splits_iata_and_icao():
    airlines = parse_airlines_html(_load("airlines.html"))
    by_name = {a["Name"]: a for a in airlines}
    assert by_name["LATAM Airlines"]["IATA"] == "LA"
    assert by_name["LATAM Airlines"]["ICAO"] == "LAN"
    assert by_name["Gol"]["IATA"] == "G3"
    assert by_name["Gol"]["ICAO"] == "GLO"


def test_parse_airlines_html_handles_iata_or_icao_only():
    airlines = parse_airlines_html(_load("airlines.html"))
    by_name = {a["Name"]: a for a in airlines}
    assert by_name["Sky2"]["IATA"] == "SK" and by_name["Sky2"]["ICAO"] is None
    assert by_name["SkyTeam"]["ICAO"] == "SKT" and by_name["SkyTeam"]["IATA"] is None


def test_parse_airlines_html_parses_aircraft_count():
    airlines = parse_airlines_html(_load("airlines.html"))
    by_name = {a["Name"]: a for a in airlines}
    assert by_name["LATAM Airlines"]["n_aircrafts"] == 340
    assert by_name["Gol"]["n_aircrafts"] == 140


def test_parse_airlines_html_skips_invalid_rows():
    airlines = parse_airlines_html(_load("airlines.html"))
    # 5 valid rows; 2 invalid (no notranslate, wrong href) must be skipped.
    assert len(airlines) == 5


def test_parse_airlines_html_empty_input_returns_empty_list():
    assert parse_airlines_html(b"") == []
    assert parse_airlines_html(b"<html><body><p>no tbody here</p></body></html>") == []

# --- parse_airports_json ---


def test_parse_airports_json_extracts_basic_fields():
    airports = parse_airports_json(_load("airports.json"))
    by_iata = {a.iata: a for a in airports}
    assert "GRU" in by_iata and "GIG" in by_iata

    gru = by_iata["GRU"]
    assert gru.icao == "SBGR"
    assert gru.country == "Brazil"
    assert abs(gru.latitude - (-23.429991)) < 1e-6
    assert abs(gru.longitude - (-46.4674)) < 1e-6
    assert gru.altitude == 2436


def test_parse_airports_json_keeps_every_country_without_filter():
    countries = {a.country for a in parse_airports_json(_load("airports.json"))}
    assert {"Brazil", "United States", "Spain"} <= countries


def test_parse_airports_json_filters_by_country_slug():
    airports = parse_airports_json(_load("airports.json"), ["united-states"])
    assert airports
    assert all(a.country == "United States" for a in airports)


def test_parse_airports_json_accepts_several_countries():
    airports = parse_airports_json(_load("airports.json"), ["brazil", "spain"])
    assert {a.country for a in airports} == {"Brazil", "Spain"}


def test_parse_airports_json_invalid_coordinates_become_none():
    """Regression: invalid coords used to be silently coerced to (0.0, 0.0)
    placing the airport in the Gulf of Guinea. They must be None now."""
    airports = parse_airports_json(_load("airports.json"))
    bad = next(a for a in airports if a.iata == "BAD")
    assert bad.latitude is None
    assert bad.longitude is None


def test_parse_airports_json_rejects_numeric_looking_junk():
    payload = json.dumps({"rows": [{
        "name": "Junk Airport", "iata": "JNK", "icao": "JJNK",
        "lat": "43.30 N", "lon": -8.37725, "country": "Spain", "alt": "-1",
    }]})
    airport = parse_airports_json(payload)[0]

    # One unusable coordinate drops the whole position: half a position would
    # read as located to anything gating on `latitude`.
    assert airport.latitude is None
    assert airport.longitude is None
    # Altitude is independent of the position and survives.
    assert airport.altitude == -1
    assert isinstance(airport.altitude, int)


@pytest.mark.parametrize("value,expected", [
    ("٤٣", None),   # Arabic-Indic digits, which \d matched before re.ASCII
    ("﻿43", None),       # U+FEFF, which String.trim() drops and str.strip() keeps
    ("43", None),       # U+001C, which str.strip() drops and String.trim() keeps
    ("  43  ", 43),           # plain spaces are still trimmed
])
def test_parse_airports_json_agrees_with_node_on_unicode(value, expected):
    payload = json.dumps({"rows": [{
        "name": "X", "iata": "XXX", "icao": "XXXX", "country": "Spain",
        "lat": value, "lon": value, "alt": value,
    }]})

    assert parse_airports_json(payload)[0].altitude == expected


@pytest.mark.parametrize(
    "value,expected",
    [(case[1], case[2]) for case in NUMERIC_CASES],
    ids=[case[0] for case in NUMERIC_CASES],
)
def test_parse_airports_json_numeric_coercion(value, expected):
    payload = json.dumps({"rows": [{
        "name": "X", "iata": "XXX", "icao": "XXXX", "country": "Spain",
        "lat": value, "lon": value, "alt": value,
    }]})
    airport = parse_airports_json(payload)[0]

    assert airport.latitude == expected
    assert airport.longitude == expected
    assert airport.altitude == expected


@pytest.mark.parametrize("literal", ["1" * 400, "9007199254740993", "-" + "1" * 400])
def test_parse_airports_json_survives_raw_numbers_no_double_can_hold(literal):
    """Written as text on purpose: json.loads turns these into unbounded ints,
    where float() raises OverflowError instead of returning inf."""
    payload = (
        '{"rows":[{"name":"X","iata":"XXX","icao":"XXXX","country":"Spain",'
        f'"lat":{literal},"lon":1,"alt":2}}]}}'
    )
    latitude = parse_airports_json(payload)[0].latitude

    assert latitude is None or math.isfinite(latitude)


@pytest.mark.parametrize("literal", ["null", "0", "false", "true", "[]", "{}", "123"])
def test_parse_airports_json_keeps_text_fields_as_strings(literal):
    """Anything else breaks callers that treat these as strings, e.g.
    get_country_flag(airport.country) slugifying a dict."""
    payload = (
        '{"rows":[{"name":%s,"iata":%s,"icao":%s,"country":%s,"lat":1,"lon":2,"alt":3}]}'
        % (literal, literal, literal, literal)
    )
    airport = parse_airports_json(payload)[0]

    assert [airport.name, airport.iata, airport.icao, airport.country] == ["", "", "", ""]


def test_parse_airports_json_country_spelling_and_slug_round_trip():
    ann = next(a for a in parse_airports_json(_load("airports.json")) if a.iata == "VBA")

    assert ann.country == "Myanmar (Burma)"
    assert country_to_slug(ann.country) == "myanmar-burma"
    # Feed sends `alt` as a string on a few rows; it must read as a number.
    assert ann.altitude == 43


def test_parse_airports_json_filter_accepts_either_country_spelling():
    for slug in ["myanmar-burma", "Myanmar (Burma)"]:
        assert len(parse_airports_json(_load("airports.json"), [slug])) == 1


def test_parse_airports_json_keeps_altitude_as_int():
    """Both ports must agree on altitude: 2436, never 2436.0."""
    gru = next(a for a in parse_airports_json(_load("airports.json")) if a.iata == "GRU")
    assert isinstance(gru.altitude, int)


def test_parse_airports_json_unknown_country_returns_empty_list():
    assert parse_airports_json(_load("airports.json"), ["atlantis"]) == []


def test_parse_airports_json_invalid_payload_returns_empty_list():
    assert parse_airports_json(b"") == []
    assert parse_airports_json(b"{}") == []
    assert parse_airports_json(b"<html>not json</html>") == []


# --- country_to_slug ---

def test_country_to_slug_matches_countries_enum_spelling():
    assert country_to_slug("United States") == "united-states"
    assert country_to_slug("Democratic Republic Of The Congo") == "democratic-republic-of-the-congo"
    assert country_to_slug("Curacao") == "curacao"
    assert country_to_slug("Curaçao") == "curacao"
    assert country_to_slug(None) == ""


def test_country_to_slug_strips_parentheses_for_flag_urls():
    """Regression: get_country_flag(airport.country) 404'd for these while the
    slug was built with a plain space-to-hyphen replacement."""
    assert country_to_slug("Myanmar (Burma)") == "myanmar-burma"
    assert country_to_slug("Cocos (Keeling) Islands") == "cocos-keeling-islands"
    assert country_to_slug("Falkland Islands (Malvinas)") == "falkland-islands-malvinas"
    assert country_to_slug("Timor-Leste (East Timor)") == "timor-leste-east-timor"
