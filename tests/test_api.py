# -*- coding: utf-8 -*-

from package import Core, FlightRadar24API, version

print("Testing FlightRadarAPI version %s." % version)

fr_api = FlightRadar24API()

def test_get_airlines(expect = 100):

    results = fr_api.get_airlines()
    assert len(results) >= expect

def test_get_airport(airports = ["ATL", "LAX", "DXB", "DFW"], expect = 3):

    count = 0

    for airport in airports:
        count += 1 if fr_api.get_airport(airport) else 0

    assert count >= expect

def test_get_airports(expect = 1000):

    results = fr_api.get_airports()
    assert len(results) >= expect

def test_get_zones(expect = 5):

    results = fr_api.get_zones()

    for zone, data in results.items():
        assert all([key in data for key in ["tl_y", "tl_x", "br_y", "br_x"]]) and len(results) >= expect

def test_get_flights(expect = 100):

    results = fr_api.get_flights()
    assert len(results) >= expect

def test_get_flight_details(data = ["airport", "airline", "aircraft", "time", "status", "trail"]):

    flight = fr_api.get_flights()[-1]
    details = fr_api.get_flight_details(flight.id)

    assert all([key in details for key in data])

def test_get_flights_by_airline(airlines = ["SWA", "GLO", "AZU", "UAL", "THY"], expect = 3):

    count = 0

    for airline in airlines:
        count += 1 if fr_api.get_flights(airline = airline) else 0

    assert count >= expect

def test_get_flights_by_bounds(zone = "northamerica", expect = 30):

    zone = fr_api.get_zones()[zone]
    bounds = fr_api.get_bounds(zone)

    results = fr_api.get_flights(bounds = bounds)
    assert len(results) >= expect

def test_get_airline_logo(airlines = [["WN", "SWA"], ["G3", "GLO"], ["AD", "AZU"], ["AA", "AAL"], ["TK", "THY"]]):

    logo_url_list = [fr_api.get_airline_logo(*airline) for airline in airlines]
    assert any(logo_url_list)

def test_get_country_flag(country = "United States"):

    flag_url = fr_api.get_country_flag(country)
    assert flag_url
