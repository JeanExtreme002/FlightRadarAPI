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

    def __get_details(self, data) -> Dict:
        return dict() if data is None else data

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
        self.timezone_offset_hours = self.__get_info(timezone.get("offsetHours"))
        self.timezone_abbr = self.__get_info(timezone.get("abbr"))
        self.timezone_abbr_name = self.__get_info(timezone.get("abbrName"))

        # Other information.
        self.visible = self.__get_info(details.get("visible"))
        self.website = self.__get_info(details.get("website"))

    def set_airport_details(self, airport_details: Dict) -> None:
        """
        Set airport details to the instance. Use FlightRadar24API.get_airport_details(...) method to get it.
        """
        # Get airport data.
        airport = self.__get_details(airport_details.get("airport"))
        airport = self.__get_details(airport.get("pluginData"))

        # Get information about the airport.
        details = self.__get_details(airport.get("details"))

        # Get location information.
        position = self.__get_details(details.get("position"))
        country = self.__get_details(position.get("country"))
        region = self.__get_details(position.get("region"))

        # Get reviews of the airport.
        flight_diary = self.__get_details(airport.get("flightdiary"))
        ratings = self.__get_details(flight_diary.get("ratings"))

        # Get schedule information.
        schedule = self.__get_details(airport.get("schedule"))

        # Get timezone information.
        timezone = self.__get_details(details.get("timezone"))

        # Get aircraft count.
        aircraft_count = self.__get_details(airport.get("aircraftCount"))
        aircraft_on_ground = self.__get_details(aircraft_count.get("onGround"))

        # Get URLs for more information about the airport.
        urls = self.__get_details(details.get("url"))

        # Airport location.
        self.elevation = self.__get_info(position.get("elevation"))
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
        self.weather = self.__get_details(airport.get("weather"))

        # Runway information.
        self.runways = airport.get("runways", list())

        # Aircraft count information.
        self.aircraft_on_ground = self.__get_info(aircraft_on_ground.get("total"))
        self.aircraft_visible_on_ground = self.__get_info(aircraft_on_ground.get("visible"))

        # Schedule information.
        self.arrivals = self.__get_details(schedule.get("arrivals"))
        self.departures = self.__get_details(schedule.get("departures"))

        # Link for the homepage and more information
        self.website = self.__get_info(urls.get("homepage"))
        self.wikipedia = self.__get_info(urls.get("wikipedia"))

        # Other information.
        self.visible = self.__get_info(details.get("visible"))
        self.images = self.__get_details(details.get("airportImages"))
