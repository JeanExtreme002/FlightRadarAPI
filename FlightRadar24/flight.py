# -*- coding: utf-8 -*-

class Flight(object):

    def __init__(self, flight_id, info):

        self.flight_id = flight_id
        self.icao_24bit = info[0] if info[0] else "N/A"
        self.latitude = info[1]
        self.longitude = info[2]
        self.heading = info[3]
        self.altitude = info[4]
        self.ground_speed = info[5]
        self.squawk = info[6] if info[6] else "N/A"
        self.aircraft = info[8] if info[8] else "N/A"
        self.registration = info[9] if info[9] else "N/A"
        self.time = info[10]
        self.origin = info[11] if info[11] else "N/A"
        self.destination = info[12] if info[12] else "N/A"
        self.number = info[13] if info[13] else "N/A"
        self.on_ground = True if info[14] else False
        self.vertical_speed = info[15]
        self.callsign = info[16] if info[16] else "N/A"
        self.airline_icao = info[18] if info[18] else "N/A"

    def __repr__(self):

        return self.__str__()

    def __str__(self):

        template = "<({}) {} - Altitude: {} - Ground Speed: {} - Heading: {}>"
        return template.format(self.aircraft, self.registration, self.altitude, self.ground_speed, self.heading)

    def check_info(self, **info):

        """
        Info:
        - aircraft
        - airline_icao
        - callsign
        - destination
        - flight_id
        - heading
        - icao_24bit
        - max_altitude
        - max_ground_speed
        - min_altitude
        - min_ground_speed
        - number
        - on_ground
        - origin
        - registration
        - squawk
        """

        if info.get("aircraft", self.aircraft) != self.aircraft: return False
        if info.get("airline_icao", self.airline_icao) != self.airline_icao: return False
        if info.get("callsign", self.callsign) != self.callsign: return False
        if info.get("destination", self.destination) != self.destination: return False
        if info.get("flight_id", self.flight_id) != self.flight_id: return False
        if info.get("heading", self.heading) != self.heading: return False
        if info.get("icao_24bit", self.icao_24bit) != self.icao_24bit: return False
        if info.get("max_altitude", self.altitude) < self.altitude: return False
        if info.get("min_altitude", self.altitude) > self.altitude: return False
        if info.get("max_ground_speed", self.ground_speed) < self.ground_speed: return False
        if info.get("min_ground_speed", self.ground_speed) > self.ground_speed: return False
        if info.get("number", self.number) != self.number: return False
        if info.get("on_ground", self.on_ground) != self.on_ground: return False
        if info.get("origin", self.origin) != self.origin: return False
        if info.get("registration", self.registration) != self.registration: return False
        if info.get("squawk", self.squawk) != self.squawk: return False

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

        self.aircraft_images = flight_details["aircraft"].get("images", list())
        self.aircraft_model = flight_details["aircraft"].get("model", dict()).get("text")
        self.airline_name = flight_details.get("airline", dict()).get("name")
        self.country_id = flight_details["aircraft"].get("countryId")
        self.destination_airport_info = flight_details["airport"].get("destination", dict())
        self.history = flight_details["flightHistory"]
        self.origin_airport_info = flight_details["airport"].get("origin", dict())
        self.status = flight_details["status"]
        self.time_details = flight_details["time"]
        self.trail = flight_details.get("trail", list())
