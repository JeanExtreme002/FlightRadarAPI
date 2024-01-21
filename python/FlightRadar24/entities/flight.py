# -*- coding: utf-8 -*-

from typing import Any, Dict, List, Optional
from .entity import Entity


class Flight(Entity):
    """
    Flight representation.
    """
    def __init__(self, flight_id: str, info: List[Any]):
        """
        Constructor of the Flight class.

        :param flight_id: The flight ID specifically used by FlightRadar24
        :param info: Dictionary with received data from FlightRadar24
        """
        super().__init__(
            latitude=self.__get_info(info[1]),
            longitude=self.__get_info(info[2])
        )

        self.id = flight_id
        self.icao_24bit = self.__get_info(info[0])
        self.heading = self.__get_info(info[3])
        self.altitude = self.__get_info(info[4])
        self.ground_speed = self.__get_info(info[5])
        self.squawk = self.__get_info(info[6])
        self.aircraft_code = self.__get_info(info[8])
        self.registration = self.__get_info(info[9])
        self.time = self.__get_info(info[10])
        self.origin_airport_iata = self.__get_info(info[11])
        self.destination_airport_iata = self.__get_info(info[12])
        self.number = self.__get_info(info[13])
        self.airline_iata = self.__get_info(info[13][:2])
        self.on_ground = self.__get_info(info[14])
        self.vertical_speed = self.__get_info(info[15])
        self.callsign = self.__get_info(info[16])
        self.airline_icao = self.__get_info(info[18])

    def __repr__(self) -> str:
        return self.__str__()

    def __str__(self) -> str:
        template = "<({}) {} - Altitude: {} - Ground Speed: {} - Heading: {}>"
        return template.format(self.aircraft_code, self.registration, self.altitude, self.ground_speed, self.heading)

    def __get_info(self, info: Any, default: Optional[Any] = None) -> Any:
        default = default if default is not None else self._default_text
        return info if info is not None and info != self._default_text else default

    def check_info(self, **info: Any) -> bool:
        """
        Check one or more flight information.

        You can use the prefix "max_" or "min_" in the parameter
        to compare numeric data with ">" or "<".

        Example: check_info(min_altitude = 6700, max_altitude = 13000, airline_icao = "THY")
        """

        comparison_functions = {"max": max, "min": min}

        for key, value in info.items():

            # Separate the comparison prefix if it exists.
            prefix, key = key.split("_", maxsplit=1) if key[:4] == "max_" or key[:4] == "min_" else (None, key)

            # Check if the value is greater than or less than the attribute value.
            if prefix and key in self.__dict__:
                if comparison_functions[prefix](value, self.__dict__[key]) != value: return False

            # Check if the value is equal.
            elif key in self.__dict__ and value != self.__dict__[key]: return False

        return True

    def get_altitude(self) -> str:
        """
        Return the formatted altitude, with the unit of measure.
        """
        return "{} ft".format(self.altitude)

    def get_flight_level(self) -> str:
        """
        Return the formatted flight level, with the unit of measure.
        """
        return str(self.altitude)[:3] + " FL" if self.altitude >= 10000 else self.get_altitude()

    def get_ground_speed(self) -> str:
        """
        Return the formatted ground speed, with the unit of measure.
        """
        return "{} kt".format(self.ground_speed) + ("s" if self.ground_speed > 1 else "")

    def get_heading(self) -> str:
        """
        Return the formatted heading, with the unit of measure.
        """
        return str(self.heading) + "°"

    def get_vertical_speed(self) -> str:
        """
        Return the formatted vertical speed, with the unit of measure.
        """
        return "{} fpm".format(self.vertical_speed)

    def set_flight_details(self, flight_details: Dict) -> None:
        """
        Set flight details to the instance. Use FlightRadar24API.get_flight_details(...) method to get it.
        """
        # Get aircraft data.
        aircraft = self.__get_info(flight_details.get("aircraft"), dict())

        # Get airline data.
        airline = self.__get_info(flight_details.get("airline"), dict())

        # Get airport data.
        airport = self.__get_info(flight_details.get("airport"), dict())

        # Get destination data.
        dest_airport = self.__get_info(airport.get("destination"), dict())
        dest_airport_code = self.__get_info(dest_airport.get("code"), dict())
        dest_airport_info = self.__get_info(dest_airport.get("info"), dict())
        dest_airport_position = self.__get_info(dest_airport.get("position"), dict())
        dest_airport_country = self.__get_info(dest_airport_position.get("country"), dict())
        dest_airport_timezone = self.__get_info(dest_airport.get("timezone"), dict())

        # Get origin data.
        orig_airport = self.__get_info(airport.get("origin"), dict())
        orig_airport_code = self.__get_info(orig_airport.get("code"), dict())
        orig_airport_info = self.__get_info(orig_airport.get("info"), dict())
        orig_airport_position = self.__get_info(orig_airport.get("position"), dict())
        orig_airport_country = self.__get_info(orig_airport_position.get("country"), dict())
        orig_airport_timezone = self.__get_info(orig_airport.get("timezone"), dict())

        # Get flight history.
        history = self.__get_info(flight_details.get("flightHistory"), dict())

        # Get flight status.
        status = self.__get_info(flight_details.get("status"), dict())

        # Aircraft information.
        self.aircraft_age = self.__get_info(aircraft.get("age"))
        self.aircraft_country_id = self.__get_info(aircraft.get("countryId"))
        self.aircraft_history = history.get("aircraft", list())
        self.aircraft_images = aircraft.get("images", list())
        self.aircraft_model = self.__get_info(self.__get_info(aircraft.get("model"), dict()).get("text"))

        # Airline information.
        self.airline_name = self.__get_info(airline.get("name"))
        self.airline_short_name = self.__get_info(airline.get("short"))

        # Destination airport position.
        self.destination_airport_altitude = self.__get_info(dest_airport_position.get("altitude"))
        self.destination_airport_country_code = self.__get_info(dest_airport_country.get("code"))
        self.destination_airport_country_name = self.__get_info(dest_airport_country.get("name"))
        self.destination_airport_latitude = self.__get_info(dest_airport_position.get("latitude"))
        self.destination_airport_longitude = self.__get_info(dest_airport_position.get("longitude"))

        # Destination airport information.
        self.destination_airport_icao = self.__get_info(dest_airport_code.get("icao"))
        self.destination_airport_baggage = self.__get_info(dest_airport_info.get("baggage"))
        self.destination_airport_gate = self.__get_info(dest_airport_info.get("gate"))
        self.destination_airport_name = self.__get_info(dest_airport.get("name"))
        self.destination_airport_terminal = self.__get_info(dest_airport_info.get("terminal"))
        self.destination_airport_visible = self.__get_info(dest_airport.get("visible"))
        self.destination_airport_website = self.__get_info(dest_airport.get("website"))

        # Destination airport timezone.
        self.destination_airport_timezone_abbr = self.__get_info(dest_airport_timezone.get("abbr"))
        self.destination_airport_timezone_abbr_name = self.__get_info(dest_airport_timezone.get("abbrName"))
        self.destination_airport_timezone_name = self.__get_info(dest_airport_timezone.get("name"))
        self.destination_airport_timezone_offset = self.__get_info(dest_airport_timezone.get("offset"))
        self.destination_airport_timezone_offset_hours = self.__get_info(dest_airport_timezone.get("offsetHours"))

        # Origin airport position.
        self.origin_airport_altitude = self.__get_info(orig_airport_position.get("altitude"))
        self.origin_airport_country_code = self.__get_info(orig_airport_country.get("code"))
        self.origin_airport_country_name = self.__get_info(orig_airport_country.get("name"))
        self.origin_airport_latitude = self.__get_info(orig_airport_position.get("latitude"))
        self.origin_airport_longitude = self.__get_info(orig_airport_position.get("longitude"))

        # Origin airport information.
        self.origin_airport_icao = self.__get_info(orig_airport_code.get("icao"))
        self.origin_airport_baggage = self.__get_info(orig_airport_info.get("baggage"))
        self.origin_airport_gate = self.__get_info(orig_airport_info.get("gate"))
        self.origin_airport_name = self.__get_info(orig_airport.get("name"))
        self.origin_airport_terminal = self.__get_info(orig_airport_info.get("terminal"))
        self.origin_airport_visible = self.__get_info(orig_airport.get("visible"))
        self.origin_airport_website = self.__get_info(orig_airport.get("website"))

        # Origin airport timezone.
        self.origin_airport_timezone_abbr = self.__get_info(orig_airport_timezone.get("abbr"))
        self.origin_airport_timezone_abbr_name = self.__get_info(orig_airport_timezone.get("abbrName"))
        self.origin_airport_timezone_name = self.__get_info(orig_airport_timezone.get("name"))
        self.origin_airport_timezone_offset = self.__get_info(orig_airport_timezone.get("offset"))
        self.origin_airport_timezone_offset_hours = self.__get_info(orig_airport_timezone.get("offsetHours"))

        # Flight status.
        self.status_icon = self.__get_info(status.get("icon"))
        self.status_text = self.__get_info(status.get("text"))

        # Time details.
        self.time_details = self.__get_info(flight_details.get("time"), dict())

        # Flight trail.
        self.trail = flight_details.get("trail", list())
