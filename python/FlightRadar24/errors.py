# -*- coding: utf-8 -*-


class FlightRadarError(Exception):
    """Base class for all FlightRadar24 exceptions."""
    pass


class AirportNotFoundError(FlightRadarError):
    pass


class CloudflareError(FlightRadarError):
    def __init__(self, message: str, response):
        super().__init__(message)
        self.response = response


class LoginError(FlightRadarError):
    pass
