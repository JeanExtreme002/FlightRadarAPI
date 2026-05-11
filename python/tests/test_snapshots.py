# -*- coding: utf-8 -*-

from FlightRadar24.errors import CloudflareError
from package import Countries, FlightRadar24API
from util import repeat_test

repeat_test_config = {
    "attempts": 2,
    "after": 5,
    "errors": [CloudflareError],
}

fr_api = FlightRadar24API()
_flights = None


def _get_flights():
    global _flights
    if _flights is None:
        _flights = fr_api.get_flights()
        assert len(_flights) > 0, "getFlights() returned no flights — subsequent tests will be meaningless"
    return _flights


# --- assertShape utility ---
#
# Shape leaf values:
#   None   → key/attr must exist; value may be anything including None
#   type   → isinstance check (e.g. str, int, float)
#   list   → must be a list; [shape] also checks first element
#   dict   → recurse into nested keys/attributes

_MISSING = object()


def _get(obj, key):
    if isinstance(obj, dict):
        return obj.get(key, _MISSING)
    return getattr(obj, key, _MISSING)


def assert_shape(actual, shape, path="root"):
    if shape is None:
        assert actual is not _MISSING, f"key missing at '{path}'"
        return
    if isinstance(shape, type):
        assert isinstance(actual, shape), (
            f"type mismatch at '{path}': expected {shape.__name__}, got {type(actual).__name__}"
        )
        return
    if isinstance(shape, list):
        assert isinstance(actual, list), f"'{path}' must be a list"
        if shape and actual:
            assert_shape(actual[0], shape[0], f"{path}[0]")
        return
    assert actual is not None, f"'{path}' must be a non-null object"
    for key, sub_shape in shape.items():
        value = _get(actual, key)
        assert value is not _MISSING, f"missing key '{key}' at '{path}'"
        assert_shape(value, sub_shape, f"{path}.{key}")


# --- Shape descriptors ---

FLIGHT_SHAPE = {
    "id": str,
    "icao_24bit": None,
    "latitude": None,
    "longitude": None,
    "heading": None,
    "altitude": None,
    "ground_speed": None,
    "squawk": None,
    "aircraft_code": None,
    "registration": None,
    "time": None,
    "origin_airport_iata": None,
    "destination_airport_iata": None,
    "number": None,
    "airline_iata": None,
    "on_ground": None,
    "vertical_speed": None,
    "callsign": None,
    "airline_icao": None,
}

FLIGHT_DETAILS_SHAPE = {
    "aircraft": None,
    "airline": None,
    "airport": {
        "destination": None,
        "origin": None,
    },
    "status": {
        "icon": None,
        "text": None,
    },
    "time": None,
    "trail": list,
}

AIRPORT_SHAPE = {
    "name": None,
    "icao": None,
    "iata": None,
    "country": None,
    "latitude": None,
    "longitude": None,
    "altitude": None,
}

AIRPORT_DETAILS_SHAPE = {
    "airport": {
        "pluginData": {
            "details": {
                "code": {
                    "iata": None,
                    "icao": None,
                },
                "name": None,
                "position": {
                    "country": {"name": None},
                    "latitude": None,
                    "longitude": None,
                },
                "timezone": {
                    "name": None,
                    "offset": None,
                },
            },
        },
    },
    "airlines": None,
    "aircraftImages": None,
}

AIRLINE_SHAPE = {
    "Name": None,
    "ICAO": None,
    "IATA": None,
    "n_aircrafts": None,
}

ZONE_SHAPE = {
    "tl_y": None,
    "tl_x": None,
    "br_y": None,
    "br_x": None,
}


# --- Tests ---

@repeat_test(**repeat_test_config)
def test_get_flights_shape():
    flights = _get_flights()
    assert_shape(flights[0], FLIGHT_SHAPE)


@repeat_test(**repeat_test_config)
def test_get_flight_details_shape():
    flights = _get_flights()
    details = fr_api.get_flight_details(flights[len(flights) // 2])
    assert_shape(details, FLIGHT_DETAILS_SHAPE)


@repeat_test(**repeat_test_config)
def test_get_airport_shape():
    assert_shape(fr_api.get_airport("ATL"), AIRPORT_SHAPE)


@repeat_test(**repeat_test_config)
def test_get_airport_details_shape():
    assert_shape(fr_api.get_airport_details("ATL", flight_limit=1), AIRPORT_DETAILS_SHAPE)


@repeat_test(**repeat_test_config)
def test_get_airlines_shape():
    airlines = fr_api.get_airlines()
    assert len(airlines) > 0
    assert_shape(airlines[0], AIRLINE_SHAPE)


@repeat_test(**repeat_test_config)
def test_get_airports_shape():
    airports = fr_api.get_airports([Countries.BRAZIL])
    assert len(airports) > 0
    assert_shape(airports[0], AIRPORT_SHAPE)


def test_get_zones_shape():
    zones = fr_api.get_zones()
    assert len(zones) > 0
    for zone in zones.values():
        assert_shape(zone, ZONE_SHAPE)


@repeat_test(**repeat_test_config)
def test_get_airline_logo_shape():
    result = fr_api.get_airline_logo("G3", "GLO")
    if result is not None:
        assert isinstance(result, tuple) and len(result) == 2
        assert isinstance(result[0], bytes)
        assert isinstance(result[1], str) and len(result[1]) > 0


@repeat_test(**repeat_test_config)
def test_get_country_flag_shape():
    result = fr_api.get_country_flag("Brazil")
    if result is not None:
        assert isinstance(result, tuple) and len(result) == 2
        assert isinstance(result[0], bytes)
        assert isinstance(result[1], str) and len(result[1]) > 0


@repeat_test(**repeat_test_config)
def test_get_most_tracked_shape():
    result = fr_api.get_most_tracked()
    assert isinstance(result, dict) and result is not None


@repeat_test(**repeat_test_config)
def test_get_airport_disruptions_shape():
    result = fr_api.get_airport_disruptions()
    assert isinstance(result, dict) and result is not None


@repeat_test(**repeat_test_config)
def test_get_volcanic_eruptions_shape():
    result = fr_api.get_volcanic_eruptions()
    assert isinstance(result, dict) and result is not None


@repeat_test(**repeat_test_config)
def test_search_shape():
    result = fr_api.search("Guarulhos")
    assert isinstance(result, dict) and result is not None
    for value in result.values():
        assert isinstance(value, list)
