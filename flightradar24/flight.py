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
        self.origin = array[11] if array[11] else "N/A"
        self.destination = array[12] if array[12] else "N/A"
        self.iata = array[13] if array[13] else "N/A"
        self.on_ground = True if array[14] else False
        self.vertical_speed = array[15]
        self.icao = array[16] if array[16] else "N/A"

    def __repr__(self):

        return self.__str__()

    def __str__(self):

        template = "<({}) {} - Altitude: {} - Ground Speed: {} - Heading: {}>"
        return template.format(self.aircraft, self.registration, self.altitude, self.ground_speed, self.heading)

    def get_altitude(self):

        return "{} ft".format(self.altitude)

    def get_ground_speed(self):

        return "{} kt".format(self.ground_speed) + ("s" if self.ground_speed > 1 else "")

    def get_flight_level(self):

        return str(self.altitude)[:3] + " FL" if self.altitude > 10000 else self.get_altitude()

    def get_vertical_speed(self):

        return "{} fpm".format(self.vertical_speed)
