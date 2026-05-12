# -*- coding: utf-8 -*-

import logging
from typing import Dict, List, Optional

from bs4 import BeautifulSoup

from .entities.airport import Airport

_logger = logging.getLogger(__name__)


def parse_airlines_html(html: bytes) -> List[Dict]:
    """
    Parse the airlines listing HTML page into a list of airline dicts.
    """
    soup = BeautifulSoup(html, "html.parser")
    tbody = soup.find("tbody")

    if not tbody:
        _logger.warning(
            "parse_airlines_html: no <tbody> in response — FR24 page layout may have changed."
        )
        return []

    airlines = []

    for tr in tbody.find_all("tr"):
        td_notranslate = tr.find("td", class_="notranslate")

        if not td_notranslate:
            continue

        a_element = td_notranslate.find("a", href=lambda href: href and href.startswith("/data/airlines"))

        if not a_element:
            continue

        airline_name = a_element.get_text(strip=True)

        if len(airline_name) < 2:
            continue

        td_elements = tr.find_all("td")
        iata = None
        icao = None

        if len(td_elements) >= 4:
            codes_text = td_elements[3].get_text(strip=True)

            if " / " in codes_text:
                parts = codes_text.split(" / ")
                if len(parts) == 2:
                    iata = parts[0].strip()
                    icao = parts[1].strip()
            elif len(codes_text) == 2:
                iata = codes_text
            elif len(codes_text) == 3:
                icao = codes_text

        n_aircrafts = None

        if len(td_elements) >= 5:
            aircrafts_text = td_elements[4].get_text(strip=True)
            if aircrafts_text:
                n_aircrafts = int(aircrafts_text.split(" ", maxsplit=1)[0].strip())

        airlines.append({"Name": airline_name, "ICAO": icao, "IATA": iata, "n_aircrafts": n_aircrafts})

    return airlines


def parse_airports_html(html: bytes, country_href: str) -> List[Airport]:
    """
    Parse the airports listing HTML page for a country into a list of Airport instances.
    """
    soup = BeautifulSoup(html, "html.parser")
    tbody = soup.find("tbody")

    if not tbody:
        _logger.warning(
            "parse_airports_html: no <tbody> for %s — FR24 page layout may have changed.",
            country_href,
        )
        return []

    country_name = country_href.split("/")[-1].replace("-", " ").title()
    airports = []

    for tr in tbody.find_all("tr"):
        a_elements = tr.find_all("a", attrs={"data-iata": True, "data-lat": True, "data-lon": True})

        if not a_elements:
            continue

        a_element = a_elements[0]

        icao = ""
        iata = str(a_element.get("data-iata", "")).strip()
        latitude = str(a_element.get("data-lat", "")).strip()
        longitude = str(a_element.get("data-lon", "")).strip()
        name_part = a_element.get_text(strip=True)

        small_element = a_element.find("small")

        if small_element:
            codes_text = small_element.get_text(strip=True).lstrip("(").rstrip(")").strip()
            name_part = name_part.replace(small_element.get_text(strip=True), "").replace("()", "").strip()

            if "/" in codes_text:
                code1, code2 = (s.strip() for s in codes_text.split("/", maxsplit=1))
                if len(code1) == 3 and len(code2) == 4:
                    iata, icao = code1, code2
                elif len(code1) == 4 and len(code2) == 3:
                    iata, icao = code2, code1
            elif len(codes_text) == 3:
                iata = codes_text
            elif len(codes_text) == 4:
                icao = codes_text

        lat_float: Optional[float]
        lon_float: Optional[float]
        try:
            lat_float = float(latitude) if latitude else None
            lon_float = float(longitude) if longitude else None
        except ValueError:
            _logger.warning(
                "parse_airports_html: invalid coordinates for airport %r (lat=%r, lon=%r) — skipping position.",
                name_part, latitude, longitude,
            )
            lat_float, lon_float = None, None

        airports.append(Airport(basic_info={
            "name": name_part,
            "icao": icao,
            "iata": iata,
            "lat": lat_float,
            "lon": lon_float,
            "alt": None,
            "country": country_name,
        }))

    return airports
