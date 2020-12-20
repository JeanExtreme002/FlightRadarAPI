# -*- coding: utf-8 -*-

from .core import Core
from .flight import Flight
from .request import APIRequest

class FlightRadar24API(object):

    """
    Flight Radar 24 API
    """

    __data_live_config = {
        "faa": "1",
        "satellite": "1",
        "mlat": "1",
        "flarm": "1",
        "adsb": "1",
        "gnd": "1",
        "air": "1",
        "vehicles": "1",
        "estimated": "1",
        "maxage": "14400",
        "gliders": "1",
        "stats": "1"
        }

    def get_airlines(self):

        # Get the data from Flightradar24.
        request = APIRequest(Core.base_url + Core.meta_data_endpoints["airlines"], headers = Core.headers)
        return request.get_response()["rows"]

    def get_airports(self):

        # Get the data from Flightradar24.
        request = APIRequest(Core.base_url + Core.meta_data_endpoints["airports"], headers = Core.headers)
        return request.get_response()["rows"]

    def get_data_live_config(self):

        return self.__data_live_config.copy()

    def get_flights(self, airline = None, bounds = None):

        """
        Parameter airline: must be the airline ICAO. Ex: "DAL"
        Parameter bounds: must be coordinates (y1, y2 ,x1, x2). Ex: "75.78,-75.78,-427.56,427.56"
        """

        data_live_config = self.__data_live_config.copy()

        # The options "bounds" and "airline" are parameters for the request.
        if airline: data_live_config["airline"] = airline
        if bounds: data_live_config["bounds"] = bounds

        # Get the data from Real-Time Flightradar24.
        request = APIRequest(Core.data_live_url, data_live_config, Core.headers)
        response = request.get_response()

        flights = []

        for key, value in response.items():

            # Get flights only.
            if not key in ["stats", "full_count", "version"]:
                flights.append(Flight(value))

        return flights

    def get_zones(self):

        # Get the data from Flightradar24.
        request = APIRequest(Core.base_url + Core.meta_data_endpoints["zones"], headers = Core.headers)
        zones = request.get_response()

        zones.pop("version")
        return zones

    def set_data_live_config(self, **config):

        for key, value in config.items():

            # Configure parameters only that already exist.
            if key in self.__data_live_config and value.isnumeric():
                self.__data_live_config[key] = value
