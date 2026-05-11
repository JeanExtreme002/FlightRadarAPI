# -*- coding: utf-8 -*-

"""
Unofficial SDK for FlightRadar24.

This SDK provides flight and airport data available to the public
on the FlightRadar24 website.

See more information at:
https://www.flightradar24.com/premium/
https://www.flightradar24.com/terms-and-conditions
"""

__author__ = "Jean Loui Bernard Silva de Jesus"
__version__ = "1.5.0"

from .api import FlightRadar24API
from .core import Countries
from .entities import Airport, Entity, Flight
from .errors import AirportNotFoundError, CloudflareError, FlightRadarError, LoginError
from .flight_tracker_config import FlightTrackerConfig
from .request import RetryPolicy

__all__ = [
    "FlightRadar24API",
    "Countries",
    "Airport",
    "Entity",
    "Flight",
    "AirportNotFoundError",
    "CloudflareError",
    "FlightRadarError",
    "LoginError",
    "FlightTrackerConfig",
    "RetryPolicy",
]
