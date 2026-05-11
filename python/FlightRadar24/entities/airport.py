# -*- coding: utf-8 -*-

from typing import Dict, Optional
from .entity import Entity


class Airport(Entity):
    """
    Airport representation.
    """
    def __init__(self, basic_info: Optional[Dict] = None, info: Optional[Dict] = None):
        """
        Constructor of the Airport class.

        The parameters below are optional. You can just create an Airport instance with no information
        and use the set_airport_details(...) method for having an instance with detailed information.

        :param basic_info: Basic information about the airport received from FlightRadar24
        :param info: Dictionary with more information about the airport received from FlightRadar24
        """
        super().__init__(latitude=None, longitude=None)

        if basic_info is not None:
            self.__initialize_with_basic_info(basic_info)
        if info is not None:
            self.__initialize_with_info(info)

    @classmethod
    def from_basic_info(cls, basic_info: Dict) -> "Airport":
        """Build an Airport from the listing payload (lat/lon/name/iata/icao/country)."""
        return cls(basic_info=basic_info)

    @classmethod
    def from_info(cls, info: Dict) -> "Airport":
        """Build an Airport from the airport.json `details` block."""
        return cls(info=info)

    @classmethod
    def from_details(cls, airport_details: Dict) -> "Airport":
        """Build an Airport from a full `get_airport_details` response."""
        airport = cls()
        airport.set_airport_details(airport_details)
        return airport

    def __repr__(self) -> str:
        template = "<({}) {} - Altitude: {} - Latitude: {} - Longitude: {}>"
        return template.format(self.icao, self.name, self.altitude, self.latitude, self.longitude)

    def __str__(self) -> str:
        return self.__repr__()

    def __initialize_with_basic_info(self, basic_info: Dict):
        """
        Initialize instance with basic information about the airport.
        """
        self._set_position(basic_info["lat"], basic_info["lon"])
        self.altitude = basic_info["alt"]

        self.name = basic_info["name"]
        self.icao = basic_info["icao"]
        self.iata = basic_info["iata"]

        self.country = basic_info["country"]

    def __initialize_with_info(self, info: Dict):
        """
        Initialize instance with extra information about the airport.
        """
        self._set_position(info["position"]["latitude"], info["position"]["longitude"])
        self.altitude = info["position"]["altitude"]

        self.name = info["name"]
        self.icao = info["code"]["icao"]
        self.iata = info["code"]["iata"]

        # Location information.
        position = info["position"]

        self.country = position["country"]["name"]
        self.country_code = self._get_info(position.get("country", {}).get("code"))
        self.city = self._get_info((position.get("region") or {}).get("city"))

        # Timezone information.
        timezone = info.get("timezone", {})

        self.timezone_name = self._get_info(timezone.get("name"))
        self.timezone_offset = self._get_info(timezone.get("offset"))
        self.timezone_offset_hours = self._get_info(timezone.get("offsetHours"))
        self.timezone_abbr = self._get_info(timezone.get("abbr"))
        self.timezone_abbr_name = self._get_info(timezone.get("abbrName"))

        # Other information.
        self.visible = self._get_info(info.get("visible"))
        self.website = self._get_info(info.get("website"))

    def set_airport_details(self, airport_details: Dict) -> None:
        """
        Set airport details to the instance. Use FlightRadar24API.get_airport_details(...) method to get it.
        """
        # Get airport data.
        airport = self._get_info(airport_details.get("airport"), {})
        airport = self._get_info(airport.get("pluginData"), {})

        # Get information about the airport.
        details = self._get_info(airport.get("details"), {})

        # Get location information.
        position = self._get_info(details.get("position"), {})
        code = self._get_info(details.get("code"), {})
        country = self._get_info(position.get("country"), {})
        region = self._get_info(position.get("region"), {})

        # Get reviews of the airport.
        flight_diary = self._get_info(airport.get("flightdiary"), {})
        ratings = self._get_info(flight_diary.get("ratings"), {})

        # Get schedule information.
        schedule = self._get_info(airport.get("schedule"), {})

        # Get timezone information.
        timezone = self._get_info(details.get("timezone"), {})

        # Get aircraft count.
        aircraft_count = self._get_info(airport.get("aircraftCount"), {})
        aircraft_on_ground = self._get_info(aircraft_count.get("onGround"), {})

        # Get URLs for more information about the airport.
        urls = self._get_info(details.get("url"), {})

        # Basic airport information.
        self.name = self._get_info(details.get("name"))
        self.iata = self._get_info(code.get("iata"))
        self.icao = self._get_info(code.get("icao"))
        self.altitude = self._get_info(position.get("elevation"))
        self.latitude = self._get_info(position.get("latitude"))
        self.longitude = self._get_info(position.get("longitude"))

        # Airport location.
        self.country = self._get_info(country.get("name"))
        self.country_code = self._get_info(country.get("code"))
        self.country_id = self._get_info(country.get("id"))
        self.city = self._get_info(region.get("city"))

        # Airport timezone.
        self.timezone_abbr = self._get_info(timezone.get("abbr"))
        self.timezone_abbr_name = self._get_info(timezone.get("abbrName"))
        self.timezone_name = self._get_info(timezone.get("name"))
        self.timezone_offset = self._get_info(timezone.get("offset"))

        if isinstance(self.timezone_offset, int):
            self.timezone_offset_hours = int(self.timezone_offset / 60 / 60)
            self.timezone_offset_hours = f"{self.timezone_offset_hours}:00"
        else:
            self.timezone_offset_hours = self._get_info(None)

        # Airport reviews.
        self.reviews_url = flight_diary.get("url")

        if self.reviews_url and isinstance(self.reviews_url, str):
            self.reviews_url = "https://www.flightradar24.com" + self.reviews_url
        else:
            self.reviews_url = self._get_info(self.reviews_url)

        self.reviews = self._get_info(flight_diary.get("reviews"))
        self.evaluation = self._get_info(flight_diary.get("evaluation"))

        self.average_rating = self._get_info(ratings.get("avg"))
        self.total_rating = self._get_info(ratings.get("total"))

        # Weather information.
        self.weather = self._get_info(airport.get("weather"), {})

        # Runway information.
        self.runways = airport.get("runways", [])

        # Aircraft count information.
        self.aircraft_on_ground = self._get_info(aircraft_on_ground.get("total"))
        self.aircraft_visible_on_ground = self._get_info(aircraft_on_ground.get("visible"))

        # Schedule information.
        self.arrivals = self._get_info(schedule.get("arrivals"), {})
        self.departures = self._get_info(schedule.get("departures"), {})

        # Link for the homepage and more information
        self.website = self._get_info(urls.get("homepage"))
        self.wikipedia = self._get_info(urls.get("wikipedia"))

        # Other information.
        self.visible = self._get_info(details.get("visible"))
        self.images = self._get_info(details.get("airportImages"), {})
