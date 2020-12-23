# -*- coding: utf-8 -*-

import os, sys

current_dir = os.getcwd()
sys.path.append(current_dir)

from FlightRadar24 import __version__ as version
from FlightRadar24.api import FlightRadar24API
from FlightRadar24.core import Core
