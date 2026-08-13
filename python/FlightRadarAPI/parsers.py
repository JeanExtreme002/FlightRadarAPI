# -*- coding: utf-8 -*-

import json
import logging
import math
import re
import unicodedata
from enum import Enum
from typing import Dict, Iterable, List, Optional, Union

from bs4 import BeautifulSoup

from .entities.airport import Airport

_logger = logging.getLogger(__name__)

# ASCII only: \d would otherwise match Unicode digits such as "٤٣".
NUMERIC_PATTERN = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$", re.ASCII)

# str.strip() and trim() disagree on U+001C-U+001F and U+FEFF: pick one set.
SURROUNDING_SPACE = " \t\n\r\f\v"

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


def country_to_slug(country: object) -> str:
    """
    Slugify a country name the way FR24 spells it in its data page URLs, so feed
    rows can be matched against the Countries enum ("United States" -> "united-states").
    """
    # `.value` unwraps a Countries member, which str() would render as
    # "Countries.BRAZIL". Diacritics are stripped so a future "Curaçao" still
    # matches "curacao"; `is None` rather than truthiness because str(0 or "") is
    # "" here while String(0 ?? "") is "0" in Node.
    if isinstance(country, Enum):
        country = country.value

    decomposed = unicodedata.normalize("NFKD", "" if country is None else str(country))
    ascii_only = "".join(char for char in decomposed if not unicodedata.combining(char))

    # Punctuation becomes a hyphen rather than being deleted: FR24's own assets are
    # named that way, e.g. flags-small/cote-d-ivoire.svg.
    return re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")


def _to_text(value: object) -> str:
    """
    Keep a text field as a string, or "" when the feed sends anything else.

    Airport documents these as strings and callers treat them as such:
    get_country_flag(airport.country) would slugify a dict into "object-object"
    and request that flag.
    """
    return value if isinstance(value, str) else ""


def _to_number(value: object) -> Optional[Union[int, float]]:
    """
    Coerce a numeric feed field into a number, or None when it is unusable.

    An unusable coordinate must not become 0.0: that would place the airport in
    the Gulf of Guinea instead of marking its position as unknown.

    Plain whole numbers stay ints, so an altitude reads 2436 in both ports rather
    than 2436.0 here -- the feed sends `alt` as an int for most rows and as a
    string ("-1") for the rest. Anything written with a decimal point or an
    exponent stays a float: "2436.0" and "1e3" are floats here and integral
    Numbers in Node, equal in value but not in type.
    """
    # bool is an int here, and str([43]) would invent a number.
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None

    if isinstance(value, str):
        stripped = value.strip(SURROUNDING_SPACE)

        if not NUMERIC_PATTERN.match(stripped):
            return None

        text: Union[int, float, str] = stripped
    else:
        text = value

    # One conversion, so overflow is handled once: Python ints have no ceiling.
    try:
        number = float(text)
    except OverflowError:
        return None

    if not math.isfinite(number):
        return None

    try:
        exact = int(text)
    except (ValueError, OverflowError):
        return number

    # int only when lossless (so -23.4 survives) and only where JavaScript is exact.
    return exact if exact == number and abs(exact) <= MAX_EXACT_INTEGER else number


def parse_airports_json(
    payload: Union[bytes, str, Dict], countries: Optional[Iterable[object]] = None,
) -> List[Airport]:
    """
    Parse the airports JSON feed into a list of Airport instances.

    :param payload: Body of Core.airports_json_url.
    :param countries: Country slugs, or Countries members. Every airport is kept when omitted.
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
    unpositioned = []
    airports = []

    for row in rows:
        if not isinstance(row, dict):
            continue

        # Slugified only when filtering: it is otherwise unused, and this loop
        # runs over every airport in the feed.
        if wanted is not None:
            slug = country_to_slug(row.get("country"))

            if slug not in wanted:
                continue
            matched.add(slug)

        latitude = _to_number(row.get("lat"))
        longitude = _to_number(row.get("lon"))

        # One bad coordinate drops both: half a position reads as located.
        if latitude is None or longitude is None:
            latitude = longitude = None
            unpositioned.append(_to_text(row.get("name")))

        airports.append(Airport(basic_info={
            "name": _to_text(row.get("name")),
            "icao": _to_text(row.get("icao")),
            "iata": _to_text(row.get("iata")),
            "lat": latitude,
            "lon": longitude,
            "alt": _to_number(row.get("alt")),
            "country": _to_text(row.get("country")),
        }))

    # One line, not one per row: the feed carries every airport.
    if unpositioned:
        _logger.warning(
            "parse_airports_json: %d airport(s) had unusable coordinates and carry no position (e.g. %s).",
            len(unpositioned), ", ".join(repr(name) for name in unpositioned[:3]),
        )

    if wanted is not None:
        missing = sorted(wanted - matched)

        if missing:
            _logger.warning(
                "parse_airports_json: no airports found for %s — check the Countries enum.",
                ", ".join(missing),
            )

    return airports
