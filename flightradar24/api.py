# -*- coding: utf-8 -*-

from .core import Core
from .flight import Flight
from .request import APIRequest

class FlightRadar24API(object):

    """
    Flight Radar 24 API
    """

    def get_airlines(self):

        request = APIRequest(Core.base_url + Core.meta_data_endpoints["airlines"], headers = Core.headers)
        return request.get_response()

    def get_airports(self):

        request = APIRequest(Core.base_url + Core.meta_data_endpoints["airports"], headers = Core.headers)
        return request.get_response()

    def get_flights(self):

        request = APIRequest(Core.data_live_url, Core.data_live_params, Core.headers)
        response = request.get_response()

        for key, value in response.items():
            if not key in ["stats", "full_count", "version"]:
                yield Flight(value)

    def get_zones(self):

        request = APIRequest(Core.base_url + Core.meta_data_endpoints["zones"], headers = Core.headers)
        return request.get_response()
