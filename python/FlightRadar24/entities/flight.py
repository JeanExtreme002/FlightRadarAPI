# -*- coding: utf-8 -*-

from enum import IntEnum
from typing import Any, Dict, List

from .entity import Entity


class _Field(IntEnum):
    ICAO24BIT = 0
    LATITUDE = 1
    LONGITUDE = 2
    HEADING = 3
    ALTITUDE = 4
    GROUND_SPEED = 5
    SQUAWK = 6
    # index 7: unused
    AIRCRAFT_CODE = 8
    REGISTRATION = 9
    TIME = 10
    ORIGIN_IATA = 11
    DESTINATION_IATA = 12
    FLIGHT_NUMBER = 13
    ON_GROUND = 14
    VERTICAL_SPEED = 15
    CALLSIGN = 16
    # index 17: unused
    AIRLINE_ICAO = 18


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
            latitude=self._get_info(info[_Field.LATITUDE]),
            longitude=self._get_info(info[_Field.LONGITUDE]),
        )

        self.id = flight_id
        self.icao_24bit = self._get_info(info[_Field.ICAO24BIT])
        self.heading = self._get_info(info[_Field.HEADING])
        self.altitude = self._get_info(info[_Field.ALTITUDE])
        self.ground_speed = self._get_info(info[_Field.GROUND_SPEED])
        self.squawk = self._get_info(info[_Field.SQUAWK])
        self.aircraft_code = self._get_info(info[_Field.AIRCRAFT_CODE])
        self.registration = self._get_info(info[_Field.REGISTRATION])
        self.time = self._get_info(info[_Field.TIME])
        self.origin_airport_iata = self._get_info(info[_Field.ORIGIN_IATA])
        self.destination_airport_iata = self._get_info(info[_Field.DESTINATION_IATA])
        self.number = self._get_info(info[_Field.FLIGHT_NUMBER])
        self.airline_iata = self._get_info(info[_Field.FLIGHT_NUMBER][:2] if info[_Field.FLIGHT_NUMBER] else None)
        self.on_ground = self._get_info(info[_Field.ON_GROUND])
        self.vertical_speed = self._get_info(info[_Field.VERTICAL_SPEED])
        self.callsign = self._get_info(info[_Field.CALLSIGN])
        self.airline_icao = self._get_info(info[_Field.AIRLINE_ICAO])

    def __repr__(self) -> str:
        return self.__str__()

    def __str__(self) -> str:
        template = "<({}) {} - Altitude: {} - Ground Speed: {} - Heading: {}>"
        return template.format(self.aircraft_code, self.registration, self.altitude, self.ground_speed, self.heading)

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
                if comparison_functions[prefix](value, self.__dict__[key]) != value:
                    return False

            # Check if the value is equal.
            elif key in self.__dict__ and value != self.__dict__[key]:
                return False

        return True

    def get_altitude(self) -> str:
        """
        Return the formatted altitude, with the unit of measure.
        """
        if not isinstance(self.altitude, (int, float)):
            return self._default_text
        return f"{self.altitude} ft"

    def get_flight_level(self) -> str:
        """
        Return the formatted flight level, with the unit of measure.
        """
        if not isinstance(self.altitude, (int, float)):
            return self._default_text
        return f"{str(self.altitude)[:3]} FL" if self.altitude >= 10000 else self.get_altitude()

    def get_ground_speed(self) -> str:
        """
        Return the formatted ground speed, with the unit of measure.
        """
        if not isinstance(self.ground_speed, (int, float)):
            return self._default_text
        return f"{self.ground_speed} kt{'s' if self.ground_speed > 1 else ''}"

    def get_heading(self) -> str:
        """
        Return the formatted heading, with the unit of measure.
        """
        if not isinstance(self.heading, (int, float)):
            return self._default_text
        return f"{self.heading}°"

    def get_vertical_speed(self) -> str:
        """
        Return the formatted vertical speed, with the unit of measure.
        """
        if not isinstance(self.vertical_speed, (int, float)):
            return self._default_text
        return f"{self.vertical_speed} fpm"

    def set_flight_details(self, flight_details: Dict) -> None:
        """
        Set flight details to the instance. Use FlightRadar24API.get_flight_details(...) method to get it.
        """
        # Get aircraft data.
        aircraft = self._get_info(flight_details.get("aircraft"), {})

        # Get airline data.
        airline = self._get_info(flight_details.get("airline"), {})

        # Get airport data.
        airport = self._get_info(flight_details.get("airport"), {})

        # Get destination data.
        dest_airport = self._get_info(airport.get("destination"), {})
        dest_airport_code = self._get_info(dest_airport.get("code"), {})
        dest_airport_info = self._get_info(dest_airport.get("info"), {})
        dest_airport_position = self._get_info(dest_airport.get("position"), {})
        dest_airport_country = self._get_info(dest_airport_position.get("country"), {})
        dest_airport_timezone = self._get_info(dest_airport.get("timezone"), {})

        # Get origin data.
        orig_airport = self._get_info(airport.get("origin"), {})
        orig_airport_code = self._get_info(orig_airport.get("code"), {})
        orig_airport_info = self._get_info(orig_airport.get("info"), {})
        orig_airport_position = self._get_info(orig_airport.get("position"), {})
        orig_airport_country = self._get_info(orig_airport_position.get("country"), {})
        orig_airport_timezone = self._get_info(orig_airport.get("timezone"), {})

        # Get flight history.
        history = self._get_info(flight_details.get("flightHistory"), {})

        # Get flight status.
        status = self._get_info(flight_details.get("status"), {})

        # Aircraft information.
        self.aircraft_age = self._get_info(aircraft.get("age"))
        self.aircraft_country_id = self._get_info(aircraft.get("countryId"))
        self.aircraft_history = history.get("aircraft", [])
        self.aircraft_images = aircraft.get("images", [])
        self.aircraft_model = self._get_info(self._get_info(aircraft.get("model"), {}).get("text"))

        # Airline information.
        self.airline_name = self._get_info(airline.get("name"))
        self.airline_short_name = self._get_info(airline.get("short"))

        # Destination airport position.
        self.destination_airport_altitude = self._get_info(dest_airport_position.get("altitude"))
        self.destination_airport_country_code = self._get_info(dest_airport_country.get("code"))
        self.destination_airport_country_name = self._get_info(dest_airport_country.get("name"))
        self.destination_airport_latitude = self._get_info(dest_airport_position.get("latitude"))
        self.destination_airport_longitude = self._get_info(dest_airport_position.get("longitude"))

        # Destination airport information.
        self.destination_airport_icao = self._get_info(dest_airport_code.get("icao"))
        self.destination_airport_baggage = self._get_info(dest_airport_info.get("baggage"))
        self.destination_airport_gate = self._get_info(dest_airport_info.get("gate"))
        self.destination_airport_name = self._get_info(dest_airport.get("name"))
        self.destination_airport_terminal = self._get_info(dest_airport_info.get("terminal"))
        self.destination_airport_visible = self._get_info(dest_airport.get("visible"))
        self.destination_airport_website = self._get_info(dest_airport.get("website"))

        # Destination airport timezone.
        self.destination_airport_timezone_abbr = self._get_info(dest_airport_timezone.get("abbr"))
        self.destination_airport_timezone_abbr_name = self._get_info(dest_airport_timezone.get("abbrName"))
        self.destination_airport_timezone_name = self._get_info(dest_airport_timezone.get("name"))
        self.destination_airport_timezone_offset = self._get_info(dest_airport_timezone.get("offset"))
        self.destination_airport_timezone_offset_hours = self._get_info(dest_airport_timezone.get("offsetHours"))

        # Origin airport position.
        self.origin_airport_altitude = self._get_info(orig_airport_position.get("altitude"))
        self.origin_airport_country_code = self._get_info(orig_airport_country.get("code"))
        self.origin_airport_country_name = self._get_info(orig_airport_country.get("name"))
        self.origin_airport_latitude = self._get_info(orig_airport_position.get("latitude"))
        self.origin_airport_longitude = self._get_info(orig_airport_position.get("longitude"))

        # Origin airport information.
        self.origin_airport_icao = self._get_info(orig_airport_code.get("icao"))
        self.origin_airport_baggage = self._get_info(orig_airport_info.get("baggage"))
        self.origin_airport_gate = self._get_info(orig_airport_info.get("gate"))
        self.origin_airport_name = self._get_info(orig_airport.get("name"))
        self.origin_airport_terminal = self._get_info(orig_airport_info.get("terminal"))
        self.origin_airport_visible = self._get_info(orig_airport.get("visible"))
        self.origin_airport_website = self._get_info(orig_airport.get("website"))

        # Origin airport timezone.
        self.origin_airport_timezone_abbr = self._get_info(orig_airport_timezone.get("abbr"))
        self.origin_airport_timezone_abbr_name = self._get_info(orig_airport_timezone.get("abbrName"))
        self.origin_airport_timezone_name = self._get_info(orig_airport_timezone.get("name"))
        self.origin_airport_timezone_offset = self._get_info(orig_airport_timezone.get("offset"))
        self.origin_airport_timezone_offset_hours = self._get_info(orig_airport_timezone.get("offsetHours"))

        # Flight status.
        self.status_icon = self._get_info(status.get("icon"))
        self.status_text = self._get_info(status.get("text"))

        # Time details.
        self.time_details = self._get_info(flight_details.get("time"), {})

        # Flight trail.
        self.trail = flight_details.get("trail", [])
