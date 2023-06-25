# -*- coding: utf-8 -*-

from typing import Any, Dict
from .entity import Entity


class Airport(Entity):
    """
    Airport representation.
    """
    __default_text = "N/A"

    def __init__(self, info: Dict = dict(), details: Dict = dict()):
        """
        Constructor of the Airport class.

        :param info: Basic information about the airport
        :param details: Dictionary with more information about the airport
        """
        if info: self.__initialize_with_basic_info(info)
        if details: self.__initialize_with_details(details)

        self.__raw_information = info.copy()
        self.__raw_information.update(details.copy())

    def __getitem__(self, key):
        return self.__raw_information[key]

    def __repr__(self) -> str:
        template = "<({}) {} - Altitude: {} - Latitude: {} - Longitude: {}>"
        return template.format(self.icao, self.name, self.altitude, self.latitude, self.longitude)

    def __setitem__(self, key, value):
        self.__raw_information[key] = value

    def __str__(self) -> str:
        return self.__repr__()

    def __get_info(self, info: Any) -> Any:
        return info if (info or info == 0) and info != self.__default_text else self.__default_text

    def __initialize_with_basic_info(self, info: Dict):
        """
        Initialize instance with basic information about the airport.
        """
        super().__init__(
            latitude = info["lat"],
            longitude = info["lon"]
        )
        self.altitude = info["alt"]

        self.name = info["name"]
        self.icao = info["icao"]
        self.iata = info["iata"]

        self.country = info["country"]

    def __initialize_with_details(self, details: Dict):
        """
        Initialize instance with detailed information about the airport.
        """
        super().__init__(
            latitude = details["position"]["latitude"],
            longitude = details["position"]["longitude"]
        )
        self.altitude = details["position"]["altitude"]

        self.name = details["name"]
        self.icao = details["code"]["icao"]
        self.iata = details["code"]["iata"]

        # Location information.
        position = details["position"]

        self.country = position["country"]["name"]
        self.country_code = self.__get_info(position.get("country", dict()).get("code"))
        self.city = self.__get_info(position.get("region", dict())).get("city")

        # Timezone information.
        timezone = details.get("timezone", dict())

        self.timezone_name = self.__get_info(timezone.get("name"))
        self.timezone_offset = self.__get_info(timezone.get("offset"))
        self.timezone_offsetHours = self.__get_info(timezone.get("offsetHours"))
        self.timezone_abbr = self.__get_info(timezone.get("abbr"))
        self.timezone_abbr_name = self.__get_info(timezone.get("abbrName"))

        # Other information.
        self.visible = self.__get_info(details.get("visible"))
        self.website = self.__get_info(details.get("website"))
