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

NUMERIC_PATTERN = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$")

# Number.MAX_SAFE_INTEGER, the largest integer JavaScript holds exactly.
MAX_EXACT_INTEGER = 2 ** 53 - 1


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


def _to_number(value: object) -> Optional[Union[int, float]]:
    """
    Coerce a numeric feed field into a number, or None when it is unusable.

    An unusable coordinate must not become 0.0: that would place the airport in
    the Gulf of Guinea instead of marking its position as unknown. Whole numbers
    stay ints so that altitudes read the same in both ports -- the feed sends
    `alt` as an int for most rows and as a string ("-1") for the rest.
    """
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value if abs(value) <= MAX_EXACT_INTEGER else float(value)

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    # Only strings are worth parsing; str() on anything else would invent a
    # number, e.g. str([43]) == "43".
    if not isinstance(value, str):
        return None

    text = value.strip()

    # Decimal numbers only, so both ports accept and reject exactly the same
    # strings: bare `float` would also take "1_000" and "inf".
    if not NUMERIC_PATTERN.match(text):
        return None

    # Float first: the pattern still admits values that overflow a double, both
    # as exponents ("1e999") and as plain digits ("1" * 400). Python ints have no
    # such ceiling, so checking them after int() would let those through.
    number = float(text)

    if not math.isfinite(number):
        return None

    try:
        exact = int(text)
    except ValueError:
        return number

    # JavaScript cannot represent integers past 2**53 - 1 exactly, so past that
    # both ports report the same double instead of drifting apart.
    return exact if abs(exact) <= MAX_EXACT_INTEGER else number


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

        latitude = _to_number(row.get("lat"))
        longitude = _to_number(row.get("lon"))

        if latitude is None or longitude is None:
            _logger.warning(
                "parse_airports_json: invalid coordinates for airport %r (lat=%r, lon=%r) — skipping position.",
                row.get("name", ""), row.get("lat"), row.get("lon"),
            )

        airports.append(Airport(basic_info={
            # `or ""` rather than a get() default: a JSON null must not survive
            # as None, which is what Node's `?? ""` guarantees on its side.
            "name": row.get("name") or "",
            "icao": row.get("icao") or "",
            "iata": row.get("iata") or "",
            "lat": latitude,
            "lon": longitude,
            "alt": _to_number(row.get("alt")),
            "country": row.get("country") or "",
        }))

    if wanted is not None:
        missing = sorted(wanted - matched)

        if missing:
            _logger.warning(
                "parse_airports_json: no airports found for %s — check the Countries enum.",
                ", ".join(missing),
            )

    return airports
