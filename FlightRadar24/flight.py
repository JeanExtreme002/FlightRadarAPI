# -*- coding: utf-8 -*-

class Flight(object):

    __default_text = "N/A"

    def __init__(self, flight_id, info):

        self.id = flight_id
        self.icao_24bit = self.__get_info(info[0])
        self.latitude = self.__get_info(info[1])
        self.longitude = self.__get_info(info[2])
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
        self.vertical_speed =self.__get_info(info[15])
        self.callsign = self.__get_info(info[16])
        self.airline_icao = self.__get_info(info[18])

    def __get_details(self, data):
        return dict() if data is None else data

    def __get_info(self, info):

        return info if (info or info == 0) and info != self.__default_text else self.__default_text

    def __repr__(self):

        return self.__str__()

    def __str__(self):

        template = "<({}) {} - Altitude: {} - Ground Speed: {} - Heading: {}>"
        return template.format(self.aircraft_code, self.registration, self.altitude, self.ground_speed, self.heading)

    def check_info(self, **info):

        """
        Check one or more flight information.

        You can use the prefix "max_" or "min_" in the parameter
        to compare numeric data with ">" or "<".

        Example: check_info(min_altitude = 6700, max_altitude = 13000, icao = "THY")
        """

        comparison_functions = {"max": max, "min": min}

        for key, value in info.items():

            # Separate the comparison prefix if it exists.
            prefix, key = key.split("_", maxsplit = 1) if key[:4] == "max_" or key[:4] == "min_" else (None, key)

            # Check if the value is greater than or less than the attribute value.
            if prefix and key in self.__dict__:
                if comparison_functions[prefix](value, self.__dict__[key]) != value: return False

            # Check if the values ​​are equal.
            elif key in self.__dict__ and value != self.__dict__[key]: return False

        return True

    def get_altitude(self):

        return "{} ft".format(self.altitude)

    def get_flight_level(self):

        return str(self.altitude)[:3] + " FL" if self.altitude > 10000 else self.get_altitude()

    def get_ground_speed(self):

        return "{} kt".format(self.ground_speed) + ("s" if self.ground_speed > 1 else "")

    def get_heading(self):

        return str(self.heading) + "°"

    def get_vertical_speed(self):

        return "{} fpm".format(self.vertical_speed)

    def set_flight_details(self, flight_details):

        # Get aircraft data.
        aircraft = self.__get_details(flight_details.get("aircraft"))

        # Get airline data.
        airline = self.__get_details(flight_details.get("airline"))

        # Get airport data.
        airport = self.__get_details(flight_details.get("airport"))

        # Get destination data.
        dest_aiport = self.__get_details(airport.get("destination"))
        dest_aiport_code = self.__get_details(dest_aiport.get("code"))
        dest_aiport_info = self.__get_details(dest_aiport.get("info"))
        dest_aiport_position = self.__get_details(dest_aiport.get("position"))
        dest_aiport_country = self.__get_details(dest_aiport_position.get("country"))
        dest_aiport_timezone = self.__get_details(dest_aiport.get("timezone"))

        # Get origin data.
        orig_aiport = self.__get_details(airport.get("origin"))
        orig_aiport_code = self.__get_details(orig_aiport.get("code"))
        orig_aiport_info = self.__get_details(orig_aiport.get("info"))
        orig_aiport_position = self.__get_details(orig_aiport.get("position"))
        orig_aiport_country = self.__get_details(orig_aiport_position.get("country"))
        orig_aiport_timezone = self.__get_details(orig_aiport.get("timezone"))

        # Get flight history.
        history = self.__get_details(flight_details.get("flightHistory"))

        # Get flight status.
        status = self.__get_details(flight_details.get("status"))

        # Aircraft information.
        self.aircraft_age = self.__get_info(aircraft.get("age"))
        self.aircraft_country_id = self.__get_info(aircraft.get("countryId"))
        self.aircraft_history = history.get("aircraft", list())
        self.aircraft_images = aircraft.get("images", list())
        self.aircraft_model = self.__get_info(self.__get_details(aircraft.get("model")).get("text"))

        # Airline information.
        self.airline_name = self.__get_info(airline.get("name"))
        self.airline_short_name = self.__get_info(airline.get("short"))

        # Destination airport position.
        self.destination_airport_altitude = self.__get_info(dest_aiport_position.get("altitude"))
        self.destination_airport_country_code = self.__get_info(dest_aiport_country.get("code"))
        self.destination_airport_country_name = self.__get_info(dest_aiport_country.get("name"))
        self.destination_airport_latitude = self.__get_info(dest_aiport_position.get("latitude"))
        self.destination_airport_longitude = self.__get_info(dest_aiport_position.get("longitude"))

        # Destination airport information.
        self.destination_airport_icao = self.__get_info(dest_aiport_code.get("icao"))
        self.destination_airport_baggage = self.__get_info(dest_aiport_info.get("baggage"))
        self.destination_airport_gate = self.__get_info(dest_aiport_info.get("gate"))
        self.destination_airport_name = self.__get_info(dest_aiport.get("name"))
        self.destination_airport_terminal = self.__get_info(dest_aiport_info.get("terminal"))
        self.destination_airport_visible = self.__get_info(dest_aiport.get("visible"))
        self.destination_airport_website = self.__get_info(dest_aiport.get("website"))

        # Destination airport timezone.
        self.destination_airport_timezone_abbr = self.__get_info(dest_aiport_timezone.get("abbr"))
        self.destination_airport_timezone_abbr_name = self.__get_info(dest_aiport_timezone.get("abbrName"))
        self.destination_airport_timezone_name = self.__get_info(dest_aiport_timezone.get("name"))
        self.destination_airport_timezone_offset = self.__get_info(dest_aiport_timezone.get("offset"))
        self.destination_airport_timezone_offsetHours = self.__get_info(dest_aiport_timezone.get("offsetHours"))

        # Origin airport position.
        self.origin_airport_altitude = self.__get_info(orig_aiport_position.get("altitude"))
        self.origin_airport_country_code = self.__get_info(orig_aiport_country.get("code"))
        self.origin_airport_country_name = self.__get_info(orig_aiport_country.get("name"))
        self.origin_airport_latitude = self.__get_info(orig_aiport_position.get("latitude"))
        self.origin_airport_longitude = self.__get_info(orig_aiport_position.get("longitude"))

        # Origin airport information.
        self.origin_airport_icao = self.__get_info(orig_aiport_code.get("icao"))
        self.origin_airport_baggage = self.__get_info(orig_aiport_info.get("baggage"))
        self.origin_airport_gate = self.__get_info(orig_aiport_info.get("gate"))
        self.origin_airport_name = self.__get_info(orig_aiport.get("name"))
        self.origin_airport_terminal = self.__get_info(orig_aiport_info.get("terminal"))
        self.origin_airport_visible = self.__get_info(orig_aiport.get("visible"))
        self.origin_airport_website = self.__get_info(orig_aiport.get("website"))

        # Origin airport timezone.
        self.origin_airport_timezone_abbr = self.__get_info(orig_aiport_timezone.get("abbr"))
        self.origin_airport_timezone_abbr_name = self.__get_info(orig_aiport_timezone.get("abbrName"))
        self.origin_airport_timezone_name = self.__get_info(orig_aiport_timezone.get("name"))
        self.origin_airport_timezone_offset = self.__get_info(orig_aiport_timezone.get("offset"))
        self.origin_airport_timezone_offsetHours = self.__get_info(orig_aiport_timezone.get("offsetHours"))

        # Flight status.
        self.status_icon = self.__get_info(status.get("icon"))
        self.status_text = self.__get_info(status.get("text"))

        # Time details.
        self.time_details = self.__get_details(flight_details.get("time"))

        # Flight trail.
        self.trail = flight_details.get("trail", list())
