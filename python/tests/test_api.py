# -*- coding: utf-8 -*-

import pytest

from FlightRadar24 import Flight
from FlightRadar24.errors import CloudflareError
from package import Countries, FlightRadar24API, version
from util import repeat_test

print("Testing FlightRadarAPI version %s." % version)

repeat_test_config = {
    "attempts": 2,
    "after": 5,
    "errors": [CloudflareError]
}

fr_api = FlightRadar24API()


@repeat_test(**repeat_test_config)
def test_get_airlines(expect=100, airlines=["LAN", "GLO", "DAL", "AZU", "UAE"]):
    results = fr_api.get_airlines()
    assert len(results) >= expect

    found_icaos = {airline["ICAO"] for airline in results if airline["ICAO"] in airlines}
    assert len(found_icaos) == len(airlines)


@repeat_test(**repeat_test_config)
def test_get_airport(airports=["ATL", "LAX", "DXB", "DFW"]):
    for airport in airports:
        assert fr_api.get_airport(airport).iata == airport


@repeat_test(**repeat_test_config)
def test_get_airport_details(airports=["ATL", "LAX", "DXB", "DFW"]):
    data = ["airport", "airlines", "aircraftImages"]

    for airport in airports:
        details = fr_api.get_airport_details(airport, flight_limit=1)
        assert all(key in details for key in data) and details["airport"]["pluginData"]["details"]


@repeat_test(**repeat_test_config)
def test_get_airports(expect=1800, countries=[Countries.BRAZIL, Countries.UNITED_STATES]):
    results = fr_api.get_airports(countries=countries)
    assert len(results) >= expect


@repeat_test(**repeat_test_config)
def test_get_zones(expect=5):
    results = fr_api.get_zones()

    assert len(results) >= expect

    for zone, data in results.items():
        assert all(key in data for key in ["tl_y", "tl_x", "br_y", "br_x"])


@repeat_test(**repeat_test_config)
def test_get_flights(expect=100):
    results = fr_api.get_flights()
    assert len(results) >= expect


@repeat_test(**repeat_test_config)
def test_get_flight_details():
    data = ["airport", "airline", "aircraft", "time", "status", "trail"]

    flights = fr_api.get_flights()
    flight = flights[len(flights) // 2]
    details = fr_api.get_flight_details(flight)
    assert all(key in details for key in data) and details["aircraft"]


@repeat_test(**repeat_test_config)
def test_get_flights_by_airline(airlines=["SWA", "GLO", "AZU", "UAL", "THY"], expect=3):
    count = 0

    for airline in airlines:
        flights = fr_api.get_flights(airline=airline)

        for flight in flights:
            assert flight.airline_icao == airline

        if flights: count += 1

    assert count >= expect


@repeat_test(**repeat_test_config)
def test_get_flights_by_bounds(target_zones=["northamerica", "southamerica"], expect=30):
    zones = fr_api.get_zones()

    for zone_name in target_zones:
        zone = zones[zone_name]
        bounds = fr_api.get_bounds(zone)

        flights = fr_api.get_flights(bounds=bounds)

        for flight in flights:
            assert zone["tl_y"] >= flight.latitude >= zone["br_y"]
            assert zone["tl_x"] <= flight.longitude <= zone["br_x"]

        assert len(flights) >= expect


@repeat_test(**repeat_test_config)
def test_get_airline_logo(airlines=[["WN", "SWA"], ["G3", "GLO"], ["AD", "AZU"], ["AA", "AAL"], ["TK", "THY"]]):
    expected = len(airlines) * 0.8
    found = 0

    for airline in airlines:
        result = fr_api.get_airline_logo(*airline)
        if result and len(result[0]) > 512: found += 1

    assert found >= expected


@repeat_test(**repeat_test_config)
def test_get_country_flag(countries=["United States", "Brazil", "Egypt", "Japan", "South Korea", "Canada"]):
    expected = len(countries) * 0.8
    found = 0

    for country in countries:
        result = fr_api.get_country_flag(country)
        if result and len(result[0]) > 512: found += 1

    assert found >= expected


@repeat_test(**repeat_test_config)
def test_get_most_tracked():
    result = fr_api.get_most_tracked()
    assert isinstance(result, dict)


@repeat_test(**repeat_test_config)
def test_get_airport_disruptions():
    result = fr_api.get_airport_disruptions()
    assert isinstance(result, dict)


@repeat_test(**repeat_test_config)
def test_get_volcanic_eruptions():
    result = fr_api.get_volcanic_eruptions()
    assert isinstance(result, dict)


@repeat_test(**repeat_test_config)
def test_search():
    result = fr_api.search("Guarulhos")
    assert isinstance(result, dict)
    for value in result.values():
        assert isinstance(value, list)


def test_get_bounds():
    zone = {"tl_y": 75.78, "br_y": -75.78, "tl_x": -427.56, "br_x": 427.56}
    assert fr_api.get_bounds(zone) == "75.78,-75.78,-427.56,427.56"


def test_get_bounds_by_point():
    expected = "52.58594974202871,52.54997688140807,13.253064418048115,13.3122478541492"
    actual = fr_api.get_bounds_by_point(52.567967, 13.282644, 2000)
    assert actual == expected


def test_get_airport_invalid_code():
    with pytest.raises(ValueError):
        fr_api.get_airport("X")


def test_set_flight_tracker_config_invalid_key():
    with pytest.raises(KeyError):
        fr_api.set_flight_tracker_config(unknown_key="1")


def test_set_flight_tracker_config_invalid_value():
    with pytest.raises(TypeError):
        fr_api.set_flight_tracker_config(limit="not_a_number")


_check_info_flight = Flight("123456789", [
    "ABC123", -23.5, -46.6, 180, 35000, 450,
    "1234", None, "B738", "PR-ABC", 1620000000,
    "GRU", "GIG", "G31234", 0, 0, "GLO1234", None, "GLO",
])


def test_check_info_exact_match():
    assert _check_info_flight.check_info(altitude=35000)


def test_check_info_range_within_bounds():
    assert _check_info_flight.check_info(min_altitude=30000, max_altitude=40000)


def test_check_info_exact_mismatch():
    assert not _check_info_flight.check_info(altitude=40000)


def test_check_info_max_exceeded():
    assert not _check_info_flight.check_info(max_altitude=30000)


def test_check_info_string_match():
    assert _check_info_flight.check_info(airline_icao="GLO")


def test_check_info_string_mismatch():
    assert not _check_info_flight.check_info(airline_icao="TAM")


def test_check_info_combined():
    assert _check_info_flight.check_info(min_altitude=30000, max_altitude=40000, airline_icao="GLO")
