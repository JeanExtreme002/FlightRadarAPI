# -*- coding: utf-8 -*-

from .core import Core
from .flight import Flight
from .request import APIRequest
import json

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

    async def get_airlines(self):

        # Get the data from Flightradar24.
        request = await APIRequest.main(Core.airlines_data_url, headers = Core.json_headers)
        request = request[0]
        return json.loads(request.decode('UTF-8'))['rows']


    async def get_airline_logo(self, iata, icao):

        # Get the first airline logo URL.
        first_logo_url = Core.airline_logo_url.format(iata, icao)
        # Check if there was a problem with the request. If not, the URL is returned.
        code1 = await APIRequest.main(first_logo_url, headers = Core.image_headers)
        first_status_code = code1[1]
        if not str(first_status_code).startswith("4"): return first_logo_url

        # Get the second airline logo URL.
        second_logo_url = Core.alternative_airline_logo_url.format(icao)

        # Check if there was  problem with the request. If not, the URL is returned.
        code2 = await APIRequest.main(second_logo_url, headers = Core.image_headers)
        second_status_code = code2[1]
        if not str(second_status_code).startswith("4"): return second_logo_url

    async def get_airport(self, code):

        # Get the airport data from Flightradar24.
        request = await APIRequest.main(Core.airport_data_url.format(code), headers = Core.json_headers)
        return json.loads(request[0].decode('UTF-8'))['details']
    async def get_airports(self):

        # Get the airports data from Flightradar24.
        request = await APIRequest.main(Core.airports_data_url, headers = Core.json_headers)
        return json.loads(request[0].decode('UTF-8'))['rows']
    async def get_bounds(self, zone):

        # Convert coordinate dictionary (tl_y, tl_x, br_y, br_x) to string "y1, y2, x1, x2".
        return "{},{},{},{}".format(zone["tl_y"], zone["br_y"] , zone["tl_x"], zone["br_x"])

    async def get_country_flag(self, country):

        # Get the country flag image URL.
        flag_url = Core.country_flag_url.format(country.lower().replace(" ", "-"))

        # Check if there was a problem with the request. If not, the URL is returned.
        status_code = await APIRequest.main(flag_url, headers = Core.image_headers)[1]
        if not str(status_code).startswith("4"): return flag_url

    async def get_flight_details(self, flight_id):

        # Get the flight details from Data Live Flightradar24.
        request = await APIRequest.main(Core.flight_data_url.format(flight_id), headers = Core.json_headers)
        return json.loads(request[0].decode('UTF-8'))

    async def get_flights(self, airline = None, bounds = None):

        """
        Parameter airline: must be the airline ICAO. Ex: "DAL"
        Parameter bounds: must be coordinates (y1, y2 ,x1, x2). Ex: "75.78,-75.78,-427.56,427.56"
        """

        request_params = self.__real_time_flight_tracker_config.copy()

        # Insert the parameters "airline" and "bounds" in the dictionary for the request.
        if airline: request_params["airline"] = airline
        if bounds: request_params["bounds"] = bounds.replace(",", "%2C")

        # Get all flights from Data Live Flightradar24.
        request = await APIRequest.main(Core.real_time_flight_tracker_data_url, request_params, Core.json_headers)
        request = json.loads(request[0].decode('UTF-8'))

        flights = []

        for flight_id, flight_info in request.items():

            # Get flights only.
            if flight_id[0].isnumeric():
                flights.append(Flight(flight_id, flight_info))
        return flights

    async def get_real_time_flight_tracker_config(self):

        return self.__real_time_flight_tracker_config.copy()

    async def get_zones(self):

        # Get the zones data from Flightradar24.
        request = await APIRequest.main(Core.zones_data_url, headers = Core.json_headers)
        zones = json.loads(request[0].decode('UTF-8'))


        # Remove version information.
        zones.pop("version")
        return zones

    async def set_real_time_flight_tracker_config(self, **config):

        for key, value in config.items():

            # Check if the parameter exists and if the value is numeric.
            if key in self.__real_time_flight_tracker_config and value.isnumeric():
                self.__real_time_flight_tracker_config[key] = value
