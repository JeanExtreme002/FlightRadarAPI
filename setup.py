# -*- coding: utf-8 -*-

from FlightRadar24 import __version__
from setuptools import setup, find_packages

with open("README.md") as file:
    README = file.read()

setup(
    name = "FlightRadarAPI",
    version = __version__,
    description = "API for FlightRadar24",
    long_description = README,
    long_description_content_type = "text/markdown",
    author = "Jean Loui Bernard Silva de Jesus",
    url = "https://github.com/JeanExtreme002/FlightRadarAPI",
    license = "MIT",
    keywords = "flightradar24 api",
    packages = find_packages(exclude = ("tests", "docs")),
    install_requires = ["Brotli", "requests"],
    classifiers = [
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3 :: Only",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8"
    ]
)
