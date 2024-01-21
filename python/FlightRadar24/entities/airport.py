# -*- coding: utf-8 -*-

from typing import Any, Dict, Optional
from .entity import Entity


class Airport(Entity):
    """
    Airport representation.
    """
    def __init__(self, basic_info: Dict = dict(), info: Dict = dict()):
        """
        Constructor of the Airport class.

        The parameters below are optional. You can just create an Airport instance with no information
        and use the set_airport_details(...) method for having an instance with detailed information.

        :param basic_info: Basic information about the airport received from FlightRadar24
        :param info: Dictionary with more information about the airport received from FlightRadar24
        """
        if basic_info: self.__initialize_with_basic_info(basic_info)
        if info: self.__initialize_with_info(info)

    def __repr__(self) -> str:
        template = "<({}) {} - Altitude: {} - Latitude: {} - Longitude: {}>"
        return template.format(self.icao, self.name, self.altitude, self.latitude, self.longitude)

    def __str__(self) -> str:
        return self.__repr__()

    def __get_info(self, info: Any, default: Optional[Any] = None) -> Any:
        default = default if default is not None else self._default_text
        return info if info is not None and info != self._default_text else default

    def __initialize_with_basic_info(self, basic_info: Dict):
        """
        Initialize instance with basic information about the airport.
        """
        super().__init__(
            latitude=basic_info["lat"],
            longitude=basic_info["lon"]
        )
        self.altitude = basic_info["alt"]

        self.name = basic_info["name"]
        self.icao = basic_info["icao"]
        self.iata = basic_info["iata"]

        self.country = basic_info["country"]

    def __initialize_with_info(self, info: Dict):
        """
        Initialize instance with extra information about the airport.
        """
        super().__init__(
            latitude=info["position"]["latitude"],
            longitude=info["position"]["longitude"]
        )
        self.altitude = info["position"]["altitude"]

        self.name = info["name"]
        self.icao = info["code"]["icao"]
        self.iata = info["code"]["iata"]

        # Location information.
        position = info["position"]

        self.country = position["country"]["name"]
        self.country_code = self.__get_info(position.get("country", dict()).get("code"))
        self.city = self.__get_info(position.get("region", dict())).get("city")

        # Timezone information.
        timezone = info.get("timezone", dict())

        self.timezone_name = self.__get_info(timezone.get("name"))
        self.timezone_offset = self.__get_info(timezone.get("offset"))
        self.timezone_offset_hours = self.__get_info(timezone.get("offsetHours"))
        self.timezone_abbr = self.__get_info(timezone.get("abbr"))
        self.timezone_abbr_name = self.__get_info(timezone.get("abbrName"))

        # Other information.
        self.visible = self.__get_info(info.get("visible"))
        self.website = self.__get_info(info.get("website"))

    def set_airport_details(self, airport_details: Dict) -> None:
        """
        Set airport details to the instance. Use FlightRadar24API.get_airport_details(...) method to get it.
        """
        # Get airport data.
        airport = self.__get_info(airport_details.get("airport"), dict())
        airport = self.__get_info(airport.get("pluginData"), dict())

        # Get information about the airport.
        details = self.__get_info(airport.get("details"), dict())

        # Get location information.
        position = self.__get_info(details.get("position"), dict())
        code = self.__get_info(details.get("code"), dict())
        country = self.__get_info(position.get("country"), dict())
        region = self.__get_info(position.get("region"), dict())

        # Get reviews of the airport.
        flight_diary = self.__get_info(airport.get("flightdiary"), dict())
        ratings = self.__get_info(flight_diary.get("ratings"), dict())

        # Get schedule information.
        schedule = self.__get_info(airport.get("schedule"), dict())

        # Get timezone information.
        timezone = self.__get_info(details.get("timezone"), dict())

        # Get aircraft count.
        aircraft_count = self.__get_info(airport.get("aircraftCount"), dict())
        aircraft_on_ground = self.__get_info(aircraft_count.get("onGround"), dict())

        # Get URLs for more information about the airport.
        urls = self.__get_info(details.get("url"), dict())

        # Basic airport information.
        self.name = self.__get_info(details.get("name"))
        self.iata = self.__get_info(code.get("iata"))
        self.icao = self.__get_info(code.get("icao"))
        self.altitude = self.__get_info(position.get("elevation"))
        self.latitude = self.__get_info(position.get("latitude"))
        self.longitude = self.__get_info(position.get("longitude"))

        # Airport location.
        self.country = self.__get_info(country.get("name"))
        self.country_code = self.__get_info(country.get("code"))
        self.country_id = self.__get_info(country.get("id"))
        self.city = self.__get_info(region.get("city"))

        # Airport timezone.
        self.timezone_abbr = self.__get_info(timezone.get("abbr"))
        self.timezone_abbr_name = self.__get_info(timezone.get("abbrName"))
        self.timezone_name = self.__get_info(timezone.get("name"))
        self.timezone_offset = self.__get_info(timezone.get("offset"))

        if isinstance(self.timezone_offset, int):
            self.timezone_offset_hours = int(self.timezone_offset / 60 / 60)
            self.timezone_offset_hours = f"{self.timezone_offset_hours}:00"
        else: self.timezone_offset_hours = self.__get_info(None)

        # Airport reviews.
        self.reviews_url = flight_diary.get("url")

        if self.reviews_url and isinstance(self.reviews_url, str):
            self.reviews_url = "https://www.flightradar24.com" + self.reviews_url
        else:
            self.reviews_url = self.__get_info(self.reviews_url)

        self.reviews = self.__get_info(flight_diary.get("reviews"))
        self.evaluation = self.__get_info(flight_diary.get("evaluation"))

        self.average_rating = self.__get_info(ratings.get("avg"))
        self.total_rating = self.__get_info(ratings.get("total"))

        # Weather information.
        self.weather = self.__get_info(airport.get("weather"), dict())

        # Runway information.
        self.runways = airport.get("runways", list())

        # Aircraft count information.
        self.aircraft_on_ground = self.__get_info(aircraft_on_ground.get("total"))
        self.aircraft_visible_on_ground = self.__get_info(aircraft_on_ground.get("visible"))

        # Schedule information.
        self.arrivals = self.__get_info(schedule.get("arrivals"), dict())
        self.departures = self.__get_info(schedule.get("departures"), dict())

        # Link for the homepage and more information
        self.website = self.__get_info(urls.get("homepage"))
        self.wikipedia = self.__get_info(urls.get("wikipedia"))

        # Other information.
        self.visible = self.__get_info(details.get("visible"))
        self.images = self.__get_info(details.get("airportImages"), dict())
