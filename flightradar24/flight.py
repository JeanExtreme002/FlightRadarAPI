# -*- coding: utf-8 -*-

class Flight(object):

    def __init__(self, array):

        self.icao_24bit = array[0] if array[0] else "N/A"
        self.latitude = array[1]
        self.longitude = array[2]
        self.heading = array[3]
        self.altitude = array[4]
        self.ground_speed = array[5]
        self.squawk = array[6] if array[6] else "N/A"
        self.aircraft = array[8] if array[8] else "N/A"
        self.registration = array[9] if array[9] else "N/A"
        self.time = array[10]
        self.origin = array[11] if array[11] else "N/A"
        self.destination = array[12] if array[12] else "N/A"
        self.iata = array[13] if array[13] else "N/A"
        self.on_ground = True if array[14] else False
        self.vertical_speed = array[15]
        self.icao = array[16] if array[16] else "N/A"
        self.airline = array[18] if array[18] else "N/A"

    def __repr__(self):

        return self.__str__()

    def __str__(self):

        template = "<({}) {} - Altitude: {} - Ground Speed: {} - Heading: {}>"
        return template.format(self.aircraft, self.registration, self.altitude, self.ground_speed, self.heading)

    def check_info(self, **info):

        """
        Info:
        - aircraft
        - airline
        - destination
        - heading
        - iata
        - icao
        - icao_24bit
        - max_altitude
        - max_ground_speed
        - min_altitude
        - min_ground_speed
        - on_ground
        - origin
        - registration
        - squawk
        """

        if info.get("aircraft", self.aircraft) != self.aircraft: return False
        if info.get("airline", self.airline) != self.airline: return False
        if info.get("destination", self.destination) != self.destination: return False
        if info.get("heading", self.heading) != self.heading: return False
        if info.get("iata", self.iata) != self.iata: return False
        if info.get("icao", self.icao) != self.icao: return False
        if info.get("icao_24bit", self.icao_24bit) != self.icao_24bit: return False
        if info.get("max_altitude", self.altitude) < self.altitude: return False
        if info.get("min_altitude", self.altitude) > self.altitude: return False
        if info.get("max_ground_speed", self.ground_speed) < self.ground_speed: return False
        if info.get("min_ground_speed", self.ground_speed) > self.ground_speed: return False
        if info.get("on_ground", self.on_ground) != self.on_ground: return False
        if info.get("origin", self.origin) != self.origin: return False
        if info.get("registration", self.registration) != self.registration: return False
        if info.get("squawk", self.squawk) != self.squawk: return False

        return True

    def get_altitude(self):

        return "{} ft".format(self.altitude)

    def get_ground_speed(self):

        return "{} kt".format(self.ground_speed) + ("s" if self.ground_speed > 1 else "")

    def get_flight_level(self):

        return str(self.altitude)[:3] + " FL" if self.altitude > 10000 else self.get_altitude()

    def get_vertical_speed(self):

        return "{} fpm".format(self.vertical_speed)
