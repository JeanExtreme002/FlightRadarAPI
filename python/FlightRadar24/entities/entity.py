# -*- coding: utf-8 -*-

from math import acos, cos, radians, sin
from typing import Any, Optional

EARTH_RADIUS_KM = 6371


class Entity:
    """
    Representation of a real entity, at some location.
    """

    _default_text = "N/A"

    def __init__(self, latitude: Optional[float], longitude: Optional[float]):
        """
        Constructor of the Entity class.
        """
        self._set_position(latitude, longitude)

    def _set_position(self, latitude: Optional[float], longitude: Optional[float]) -> None:
        self.latitude = latitude
        self.longitude = longitude

    def _get_info(self, info: Any, default: Optional[Any] = None) -> Any:
        """
        Return `info` unless it is None or the sentinel for missing values; in that
        case return `default` (or the entity's default sentinel).
        """
        default = default if default is not None else self._default_text
        return info if info is not None and info != self._default_text else default

    def get_distance_from(self, entity: "Entity") -> float:
        """
        Return the distance from another entity (in kilometers).
        """
        if (self.latitude is None or self.longitude is None
                or entity.latitude is None or entity.longitude is None):
            raise ValueError("Cannot calculate distance: one or both entities have no position.")

        lat1, lon1 = radians(self.latitude), radians(self.longitude)
        lat2, lon2 = radians(entity.latitude), radians(entity.longitude)

        return acos(sin(lat1) * sin(lat2) + cos(lat1) * cos(lat2) * cos(lon2 - lon1)) * EARTH_RADIUS_KM
