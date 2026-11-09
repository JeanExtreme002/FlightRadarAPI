# -*- coding: utf-8 -*-
"""Offline parser tests against bundled fixtures.

These tests run with no network access and exist specifically so that PRs
can be gated on the parser logic without depending on FR24 being reachable
or its payloads being stable. When FR24 changes a page or feed,
update the fixtures (re-saving a real response is fine) — the assertions here
guard the parser's invariants, not byte-for-byte equality with production.
"""

import json
import os

from FlightRadarAPI.core import Countries
from FlightRadarAPI.parsers import (
    country_to_slug, parse_airlines_html, parse_airports_index, parse_airports_page, parse_inertia_page,
)

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


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
    # Thousands separator, as the page prints large fleets.
    assert by_name["Delta Air Lines"]["n_aircrafts"] == 1900
    # Only the "Largest fleets" section carries a count.
    assert by_name["Sky2"]["n_aircrafts"] is None


def test_parse_airlines_html_merges_an_airline_listed_in_two_sections():
    airlines = parse_airlines_html(_load("airlines.html"))
    # Delta and Gol appear under "Largest fleets" and again under "All airlines".
    assert [a["Name"] for a in airlines].count("Delta Air Lines") == 1
    assert [a["Name"] for a in airlines].count("Gol") == 1


def test_parse_airlines_html_keeps_a_code_shaped_name():
    airlines = parse_airlines_html(_load("airlines.html"))
    by_name = {a["Name"]: a for a in airlines}
    assert by_name["TAP"] == {"Name": "TAP", "ICAO": "TAP", "IATA": "TP", "n_aircrafts": None}


def test_parse_airlines_html_skips_invalid_rows():
    airlines = parse_airlines_html(_load("airlines.html"))
    # 6 airlines; the section link, the entry with no link, the wrong href and
    # the one-letter name must be skipped.
    assert len(airlines) == 6
    assert "All" not in [a["Name"] for a in airlines]


def test_parse_airlines_html_empty_input_returns_empty_list():
    assert parse_airlines_html(b"") == []
    assert parse_airlines_html(b"<html><body><p>no airlines here</p></body></html>") == []


# --- parse_inertia_page ---

def test_parse_inertia_page_reads_the_data_page_attribute():
    page = parse_inertia_page(_load("airports_index.html"))
    assert page["component"] == "Data/Airports"
    assert page["version"] == "919b94d2a33f365a34f99828f6eeec6a"
    assert "airportsByCountry" in page["props"]


def test_parse_inertia_page_accepts_a_decoded_json_body():
    body = json.loads(_load("airports_country.json"))
    assert parse_inertia_page(body) is body


def test_parse_inertia_page_rejects_unrecognised_payloads():
    assert parse_inertia_page(b"") is None
    assert parse_inertia_page(b"<html><body><div id=\"app\"></div></body></html>") is None
    assert parse_inertia_page(b"<div data-page=\"not json\"></div>") is None
    assert parse_inertia_page({"component": "Data/Airports"}) is None


# --- parse_airports_index ---

def test_parse_airports_index_lists_every_country_with_its_slug():
    countries = parse_airports_index(_load("airports_index.html"))
    assert [c["slug"] for c in countries] == ["brazil", "myanmar-burma", "uruguay"]
    assert countries[1]["name"] == "MYANMAR (BURMA)"


def test_parse_airports_index_slugs_match_the_countries_enum():
    slugs = {c["slug"] for c in parse_airports_index(_load("airports_index.html"))}
    assert slugs <= {c.value for c in Countries}


def test_parse_airports_index_invalid_payload_returns_empty_list():
    assert parse_airports_index(b"") == []
    assert parse_airports_index({"props": {}}) == []
    assert parse_airports_index({"props": {"airportsByCountry": [1, "x", {"name": None}]}}) == []


# --- parse_airports_page ---

def test_parse_airports_page_extracts_the_airports_of_a_country():
    airports, state_paths = parse_airports_page(json.loads(_load("airports_country.json")))
    assert state_paths == []
    assert [a.iata for a in airports] == ["CYR", "MVD"]

    mvd = airports[1]
    assert mvd.name == "Montevideo Carrasco International Airport"
    assert mvd.icao == "SUMU"
    assert mvd.country == "Uruguay"


def test_parse_airports_page_listing_carries_no_position():
    airports, _ = parse_airports_page(json.loads(_load("airports_country.json")))
    assert all(a.latitude is None and a.longitude is None and a.altitude is None for a in airports)


def test_parse_airports_page_returns_the_state_pages_of_a_split_country():
    airports, state_paths = parse_airports_page(json.loads(_load("airports_country_states.json")))
    assert airports == []
    assert state_paths == ["/data/airports/brazil/rj", "/data/airports/brazil/sp"]


def test_parse_airports_page_state_page_keeps_the_country_name():
    airports, state_paths = parse_airports_page(json.loads(_load("airports_state_sp.json")))
    assert state_paths == []
    assert [a.iata for a in airports] == ["GRU", "CGH"]
    assert {a.country for a in airports} == {"Brazil"}


def test_parse_airports_page_reads_an_html_page():
    airports, _ = parse_airports_page(_load("airports_country.html"))
    assert [a.iata for a in airports] == ["RGN"]
    # FR24 spells it "Myanmar (Burma)" on the page and "myanmar-burma" in URLs.
    assert airports[0].country == "Myanmar (Burma)"
    assert country_to_slug(airports[0].country) == Countries.MYANMAR_BURMA.value


def test_parse_airports_page_skips_rows_that_are_not_objects():
    payload = {"props": {"country": {"name": "Nowhere"}, "airports": [1, "x", None, {"iata": "RRR"}]}}
    airports, _ = parse_airports_page(payload)
    assert [a.iata for a in airports] == ["RRR"]


def test_parse_airports_page_keeps_text_fields_as_strings():
    payload = {"props": {"country": {"name": ["Brazil"]}, "airports": [{"name": 42, "iata": None, "icao": {"x": 1}}]}}
    airport = parse_airports_page(payload)[0][0]
    assert (airport.name, airport.iata, airport.icao, airport.country) == ("", "", "", "")


def test_parse_airports_page_ignores_malformed_states():
    payload = {"props": {"states": [{"url": "/data/airports/x/a"}, {"url": ""}, {"code": "B"}, "junk", {"url": 3}]}}
    assert parse_airports_page(payload) == ([], ["/data/airports/x/a"])


def test_parse_airports_page_invalid_payload_returns_nothing():
    assert parse_airports_page(b"") == ([], [])
    assert parse_airports_page(b"<html>not a data page</html>") == ([], [])
    assert parse_airports_page({"props": {}}) == ([], [])
