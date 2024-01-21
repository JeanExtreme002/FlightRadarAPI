# -*- coding: utf-8 -*-

from abc import ABC
from math import acos, cos, radians, sin


class Entity(ABC):
    """
    Representation of a real entity, at some location.
    """

    _default_text = "N/A"

    def __init__(self, latitude: float, longitude: float):
        """
        Constructor of the Entity class.
        """
        self.latitude = latitude
        self.longitude = longitude

    def get_distance_from(self, entity: "Entity") -> float:
        """
        Return the distance from another entity (in kilometers).
        """
        lat1, lon1 = self.latitude, self.longitude
        lat2, lon2 = entity.latitude, entity.longitude

        lat1, lon1 = radians(lat1), radians(lon1)
        lat2, lon2 = radians(lat2), radians(lon2)

        return acos(sin(lat1) * sin(lat2) + cos(lat1) * cos(lat2) * cos(lon2 - lon1)) * 6371
