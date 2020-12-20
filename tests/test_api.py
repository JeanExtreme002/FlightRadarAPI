# -*- coding: utf-8 -*-

from package import Core, FlightRadar24API

fr_api = FlightRadar24API()

def test_get_airlines(expect = 100):

    airlines = fr_api.get_airlines()
    assert len(airlines) > expect

def test_get_airports(expect = 1000):

    airports = fr_api.get_airports()
    assert len(airports) >= expect

def test_get_zones(expect = 5):

    zones = fr_api.get_zones()
    assert len(zones) >= expect

def test_get_flights(expect = 50):

    flights = fr_api.get_flights()
    assert len(flights) >= expect

def test_get_flights_by_airline(airlines = ["SWA", "GLO", "AZU", "UAL", "THY"], expect = 10):

    flights = []

    for airline in airlines:
        flights += fr_api.get_flights(airline = airline)

    assert all([flight.airline in airlines for flight in flights]) and len(flights) >= expect

def test_get_flights_by_bounds(zone = "northamerica", expect = 10):

    zone = fr_api.get_zones()[zone]
    bounds = "{},{},{},{}".format(zone["tl_y"], zone["tl_x"], zone["br_y"], zone["br_x"])

    flights = fr_api.get_flights(bounds = bounds)
    assert len(flights) >= expect
