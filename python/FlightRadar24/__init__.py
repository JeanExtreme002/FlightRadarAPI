# -*- coding: utf-8 -*-

"""
Deprecated import alias for the FlightRadarAPI SDK.

The package was renamed to ``FlightRadarAPI`` so the Python import name
matches the PyPI distribution name and the Node.js package name. This
module re-exports the public API and aliases every submodule so legacy
imports such as ``from FlightRadar24 import FlightRadar24API`` or
``from FlightRadar24.errors import CloudflareError`` keep working, but a
``DeprecationWarning`` is emitted on import.
"""

import importlib
import pkgutil
import sys
import warnings

import FlightRadarAPI as _pkg

warnings.warn(
    "Importing from 'FlightRadar24' is deprecated and will be removed in a "
    "future release. Import from 'FlightRadarAPI' instead "
    "(e.g. 'from FlightRadarAPI import FlightRadar24API').",
    DeprecationWarning,
    stacklevel=2,
)

# Mirror every submodule of FlightRadarAPI under the legacy FlightRadar24
# namespace so dotted imports keep resolving without touching disk.
for _info in pkgutil.walk_packages(_pkg.__path__, prefix=f"{_pkg.__name__}."):
    _mod = importlib.import_module(_info.name)
    sys.modules[_info.name.replace(_pkg.__name__, __name__, 1)] = _mod
del _info, _mod

from FlightRadarAPI import *  # noqa: E402, F401, F403
from FlightRadarAPI import __all__, __author__, __version__  # noqa: E402, F401
