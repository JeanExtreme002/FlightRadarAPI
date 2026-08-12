# -*- coding: utf-8 -*-

import json
import logging
import math
import re
import unicodedata
from typing import Dict, List, Optional, Union

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


def country_to_slug(country: Optional[str]) -> str:
    """
    Slugify a country name the way FR24 spells it in its data page URLs, so feed
    rows can be matched against the Countries enum ("United States" -> "united-states").
    """
    # The feed is ASCII today ("Curacao"); stripping diacritics keeps the match
    # working if that ever changes.
    decomposed = unicodedata.normalize("NFKD", str(country or ""))
    ascii_only = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")


def _to_coordinate(value: object) -> Optional[float]:
    """
    Coerce a feed coordinate into a float, or None when it is unusable.

    Invalid coordinates must not become 0.0: that would place the airport in the
    Gulf of Guinea instead of marking its position as unknown.
    """
    if value is None or value == "":
        return None

    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None

    return number if math.isfinite(number) else None


def parse_airports_json(payload: Union[bytes, str, Dict], countries: Optional[List[str]] = None) -> List[Airport]:
    """
    Parse the airports JSON feed into a list of Airport instances.

    :param payload: Body of Core.airports_json_url.
    :param countries: Country slugs from the Countries enum. Every airport is kept when omitted.
    """
    if isinstance(payload, (bytes, str)):
        try:
            data = json.loads(payload)
        except ValueError:
            _logger.warning("parse_airports_json: response is not valid JSON — FR24 feed may have changed.")
            return []
    else:
        data = payload

    rows = data.get("rows") if isinstance(data, dict) else None

    if not isinstance(rows, list):
        _logger.warning('parse_airports_json: no "rows" array in response — FR24 feed may have changed.')
        return []

    wanted = {country_to_slug(country) for country in countries} if countries is not None else None
    matched = set()
    airports = []

    for row in rows:
        if not isinstance(row, dict):
            continue

        slug = country_to_slug(row.get("country"))

        if wanted is not None:
            if slug not in wanted:
                continue
            matched.add(slug)

        latitude = _to_coordinate(row.get("lat"))
        longitude = _to_coordinate(row.get("lon"))

        if latitude is None or longitude is None:
            _logger.warning(
                "parse_airports_json: invalid coordinates for airport %r (lat=%r, lon=%r) — skipping position.",
                row.get("name", ""), row.get("lat"), row.get("lon"),
            )

        airports.append(Airport(basic_info={
            "name": row.get("name", ""),
            "icao": row.get("icao", ""),
            "iata": row.get("iata", ""),
            "lat": latitude,
            "lon": longitude,
            "alt": _to_coordinate(row.get("alt")),
            "country": row.get("country", ""),
        }))

    if wanted is not None:
        missing = sorted(wanted - matched)

        if missing:
            _logger.warning(
                "parse_airports_json: no airports found for %s — check the Countries enum.",
                ", ".join(missing),
            )

    return airports
