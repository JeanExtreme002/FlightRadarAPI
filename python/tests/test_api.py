# -*- coding: utf-8 -*-

from package import CloudflareError, FlightRadar24API, version
from util import repeat_test

print("Testing FlightRadarAPI version %s." % version)

repeat_test_config = {
    "attempts": 2,
    "after": 5,
    "errors": [CloudflareError]
}

fr_api = FlightRadar24API()


@repeat_test(**repeat_test_config)
def test_get_airlines(expect=100):
    results = fr_api.get_airlines()
    assert len(results) >= expect


@repeat_test(**repeat_test_config)
def test_get_airport(airports=["ATL", "LAX", "DXB", "DFW"]):
    for airport in airports:
        assert fr_api.get_airport(airport).iata == airport


@repeat_test(**repeat_test_config)
def test_get_airport_details(airports=["ATL", "LAX", "DXB", "DFW"]):
    data = ["airport", "airlines", "aircraftImages"]

    for airport in airports:
        details = fr_api.get_airport_details(airport, flight_limit=1)
        assert all([key in details for key in data]) and details["airport"]["pluginData"]["details"]


@repeat_test(**repeat_test_config)
def test_get_airports(expect=1000):
    results = fr_api.get_airports()
    assert len(results) >= expect


@repeat_test(**repeat_test_config)
def test_get_zones(expect=5):
    results = fr_api.get_zones()

    assert len(results) >= expect

    for zone, data in results.items():
        assert all([key in data for key in ["tl_y", "tl_x", "br_y", "br_x"]])


@repeat_test(**repeat_test_config)
def test_get_flights(expect=100):
    results = fr_api.get_flights()
    assert len(results) >= expect


@repeat_test(**repeat_test_config)
def test_get_flight_details():
    data = ["airport", "airline", "aircraft", "time", "status", "trail"]

    flights = fr_api.get_flights()
    middle = len(flights) // 2

    flights = flights[middle - 2: middle + 2]

    for flight in flights:
        details = fr_api.get_flight_details(flight)
        assert all([key in details for key in data]) and details["aircraft"]


@repeat_test(**repeat_test_config)
def test_get_flights_by_airline(airlines=["SWA", "GLO", "AZU", "UAL", "THY"], expect=3):
    count = 0

    for airline in airlines:
        flights = fr_api.get_flights(airline=airline)

        for flight in flights:
            assert flight.airline_icao == airline

        if len(flights) > 0: count += 1

    assert count >= expect


@repeat_test(**repeat_test_config)
def test_get_flights_by_bounds(target_zones=["northamerica", "southamerica"], expect=30):
    zones = fr_api.get_zones()

    for zone in target_zones:
        zone = zones[zone]
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


def test_get_bounds_by_point():
    expected = "52.58594974202871,52.54997688140807,13.253064418048115,13.3122478541492"
    actual = fr_api.get_bounds_by_point(52.567967, 13.282644, 2000)

    assert actual == expected
