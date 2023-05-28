# -*- coding: utf-8 -*-

from .core import Core
from .flight import Flight
from .request import APIRequest

from deprecated import deprecated
from typing import Dict, List


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
        "stats": "1",
        "limit": "5000"
        }

    def login(self, user: str, password: str) -> Dict:
        # Log in with Flightradar24 Premium user credentials
        data = {
            "email": user,
            "password": password,
            "remember": "true",
            "type": "web"
        }

        request = APIRequest(Core.user_login_url, headers = Core.json_headers, data = data)
        self.__real_time_flight_tracker_config["enc"] = request.get_cookie("_frPl")

        return request.get_content()

    def get_airlines(self) -> List[Dict]:
        # Get the data from Flightradar24.
        request = APIRequest(Core.airlines_data_url, headers = Core.json_headers)
        return request.get_content()["rows"]

    def get_airline_logo(self, iata: str, icao: str) -> str:
        # Get the first airline logo URL.
        first_logo_url = Core.airline_logo_url.format(iata, icao)

        # Check if there was a problem with the request. If not, the URL is returned.
        first_status_code = APIRequest(first_logo_url, headers = Core.image_headers).get_status_code()
        if not str(first_status_code).startswith("4"): return first_logo_url

        # Get the second airline logo URL.
        second_logo_url = Core.alternative_airline_logo_url.format(icao)

        # Check if there was a problem with the request. If not, the URL is returned.
        second_status_code = APIRequest(second_logo_url, headers = Core.image_headers).get_status_code()
        if not str(second_status_code).startswith("4"): return second_logo_url

    def get_airport(self, code: str) -> Dict:
        # Get the airport data from Flightradar24.
        request = APIRequest(Core.airport_data_url.format(code), headers = Core.json_headers)
        return request.get_content()["details"]

    def get_airports(self) -> List[Dict]:
        # Get the airports data from Flightradar24.
        request = APIRequest(Core.airports_data_url, headers = Core.json_headers)
        return request.get_content()["rows"]

    def get_bounds(self, zone: Dict[str, float]) -> str:
        # Convert coordinate dictionary (tl_y, tl_x, br_y, br_x) to string "y1, y2, x1, x2".
        return "{},{},{},{}".format(zone["tl_y"], zone["br_y"] , zone["tl_x"], zone["br_x"])

    def get_country_flag(self, country: str) -> str:
        # Get the country flag image URL.
        flag_url = Core.country_flag_url.format(country.lower().replace(" ", "-"))

        headers = Core.image_headers.copy()
        
        if "origin" in headers:
            headers.pop("origin") # Doesn't work for this request

        # Check if there is a problem with the request. If not, the URL is returned.
        status_code = APIRequest(flag_url, headers = headers).get_status_code()
        if not str(status_code).startswith("4"): return flag_url

    def get_flight_details(self, flight_id: str) -> Dict:
        # Get the flight details from Data Live Flightradar24.
        request = APIRequest(Core.flight_data_url.format(flight_id), headers = Core.json_headers)
        return request.get_content()

    def get_flights(self, airline: str = None, bounds: str = None, registration: str = None, aircraft_type: str = None) -> List[Flight]:
        """
        :param airline: the airline ICAO. Ex: "DAL"
        :param bounds: coordinates (y1, y2 ,x1, x2). Ex: "75.78,-75.78,-427.56,427.56"
        :param registration: aircraft registration
        :param aircraft_type: aircraft model code. Ex: "B737"
        """

        request_params = self.__real_time_flight_tracker_config.copy()

        # Insert the parameters "airline", "bounds", "reg",and "type" in the dictionary for the request.
        if airline: request_params["airline"] = airline
        if bounds: request_params["bounds"] = bounds.replace(",", "%2C")
        if registration: request_params["reg"] = registration
        if aircraft_type: request_params["type"] = aircraft_type

        # Get all flights from Data Live Flightradar24.
        request = APIRequest(Core.real_time_flight_tracker_data_url, request_params, Core.json_headers)
        response = request.get_content()

        flights = []

        for flight_id, flight_info in response.items():

            # Get flights only.
            if flight_id[0].isnumeric():
                flights.append(Flight(flight_id, flight_info))

        return flights

    def get_real_time_flight_tracker_config(self) -> Dict[str, str]:
        return self.__real_time_flight_tracker_config.copy()

    def get_zones(self) -> Dict:

        # Get the zones data from Flightradar24.
        request = APIRequest(Core.zones_data_url, headers = Core.json_headers)
        zones = request.get_content()

        # Remove version information.
        zones.pop("version")
        return zones

    def set_real_time_flight_tracker_config(self, **config: str) -> None:

        for key, value in config.items():

            # Check if the parameter exists and if the value is numeric.
            if key in self.__real_time_flight_tracker_config and value.isnumeric():
                self.__real_time_flight_tracker_config[key] = value
