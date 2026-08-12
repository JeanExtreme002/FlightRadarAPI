# -*- coding: utf-8 -*-
"""Offline parser tests against bundled HTML fixtures.

These tests run with no network access and exist specifically so that PRs
can be gated on the parser logic without depending on FR24 being reachable
or its HTML layout being stable. When FR24 changes the page structure,
update the fixtures (re-saving a real page is fine) — the assertions here
guard the parser's invariants, not byte-for-byte equality with production.
"""

import os

from FlightRadarAPI.parsers import country_to_slug, parse_airlines_html, parse_airports_json

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
