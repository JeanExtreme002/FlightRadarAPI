# -*- coding: utf-8 -*-

import dataclasses


@dataclasses.dataclass
class FlightTrackerConfig:
    """
    Data class with settings of the Real Time Flight Tracker.
    """
    faa: str = "1"
    satellite: str = "1"
    mlat: str = "1"
    flarm: str = "1"
    adsb: str = "1"
    gnd: str = "1"
    air: str = "1"
    vehicles: str = "1"
    estimated: str = "1"
    maxage: str = "14400"
    gliders: str = "1"
    stats: str = "1"
    limit: str = "5000"
