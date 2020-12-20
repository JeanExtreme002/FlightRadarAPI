# -*- coding: utf-8 -*-

from .core import Core
from .flight import Flight
from .request import APIRequest

class FlightRadar24API(object):

    """
    Flight Radar 24 API
    """

    __real_time_flight_tracker_config = {
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
        request = APIRequest(Core.airline_data_url, headers = Core.headers)
        return request.get_content()["rows"]

    def get_airport(self, icao = None, iata = None):

        # Get the airports and search for the airport that has the given ICAO or IATA.
        for airport in self.get_airports():
            if airport["iata"] == iata or airport["icao"] == icao: return airport

    def get_airports(self):

        # Get the data from Flightradar24.
        request = APIRequest(Core.airport_data_url, headers = Core.headers)
        return request.get_content()["rows"]

    def get_bounds(self, zone):

        # Convert coordinate dictionary (tl_y, tl_x, br_y, br_x) to string.
        return "{},{},{},{}".format(zone["tl_y"], zone["tl_x"], zone["br_y"], zone["br_x"])

    def get_flight_details(self, flight_id):

        # Get the data from Data Live Flightradar24.
        request = APIRequest(Core.flight_data_url.format(flight_id), headers = Core.headers)
        return request.get_content()

    def get_flights(self, airline = None, bounds = None):

        """
        Parameter airline: must be the airline ICAO. Ex: "DAL"
        Parameter bounds: must be coordinates (y1, y2 ,x1, x2). Ex: "75.78,-75.78,-427.56,427.56"
        """

        real_time_flight_tracker_config = self.__real_time_flight_tracker_config.copy()

        # Insert the parameters "airline" and "bounds" in the dictionary for the request.
        if airline: real_time_flight_tracker_config["airline"] = airline
        if bounds: real_time_flight_tracker_config["bounds"] = bounds

        # Get the data from Data Live Flightradar24.
        request = APIRequest(Core.real_time_flight_tracker_data_url, real_time_flight_tracker_config, Core.headers)
        response = request.get_content()

        flights = []

        for flight_id, flight_info in response.items():

            # Get flights only.
            if flight_id[0].isnumeric():
                flights.append(Flight(flight_id, flight_info))

        return flights

    def get_real_time_flight_tracker_config(self):

        return self.__real_time_flight_tracker_config.copy()

    def get_zones(self):

        # Get the data from Flightradar24.
        request = APIRequest(Core.zone_data_url, headers = Core.headers)
        zones = request.get_content()

        # Remove version information.
        zones.pop("version")
        return zones

    def set_real_time_flight_tracker_config(self, **config):

        for key, value in config.items():

            # Check if the parameter exists and if the value is numeric.
            if key in self.__real_time_flight_tracker_config and value.isnumeric():
                self.__real_time_flight_tracker_config[key] = value
