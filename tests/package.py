# -*- coding: utf-8 -*-

import os, sys

current_dir = os.getcwd()
sys.path.append(current_dir)

from FlightRadar24 import __version__ as version
from FlightRadar24 import FlightRadar24API
