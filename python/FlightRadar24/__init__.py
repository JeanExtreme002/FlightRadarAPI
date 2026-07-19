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
__version__ = "1.3.34"

from .api import FlightRadar24API, FlightTrackerConfig
from .entities import Airport, Entity, Flight
