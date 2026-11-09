# -*- coding: utf-8 -*-

import json
import logging
import re
import unicodedata
from enum import Enum
from typing import Dict, List, Optional, Tuple, Union

from bs4 import BeautifulSoup
from bs4.element import Tag

from .entities.airport import Airport

_logger = logging.getLogger(__name__)

# An airline code badge: a two-letter IATA code or a three-letter ICAO code.
# ASCII only, so a stray Unicode letter does not pass for a code.
AIRLINE_CODE_PATTERN = re.compile(r"^[A-Z0-9]{2,3}$", re.ASCII)

# A fleet size as the page prints it: "340" or "3,878".
AIRCRAFT_COUNT_PATTERN = re.compile(r"^\d{1,3}(?:[,.]\d{3})*$|^\d+$", re.ASCII)

AIRLINES_PATH_PREFIX = "/data/airlines/"


def _is_airline_link(href: object) -> bool:
    return isinstance(href, str) and href.startswith(AIRLINES_PATH_PREFIX)


def _leaf_texts(root: Tag, tag: str) -> List[str]:
    """
    Text of the `tag` elements under `root` that hold no other element.

    The name element is left out by its `title` attribute: an airline called
    "TAP" would otherwise read as an ICAO code.
    """
    return [
        element.get_text(strip=True)
        for element in root.find_all(tag)
        if element.find() is None and not element.has_attr("title")
    ]


def _airline_name(link: Tag) -> str:
    """
    The airline name of a listing entry.

    The name sits in the element titled with it, with the logo's aria-label as a
    fallback; the anchor text also carries the codes and the fleet size.
    """
    for attribute in ("title", "aria-label"):
        element = link.find(lambda tag, name=attribute: tag.has_attr(name))

        if isinstance(element, Tag):
            return str(element[attribute]).strip()

    return link.get_text(strip=True)


def parse_airlines_html(html: bytes) -> List[Dict]:
    """
    Parse the airlines listing page into a list of airline dicts.

    Every airline is a link to its data page, with the IATA and ICAO codes as
    badges next to the name. The "Largest fleets" section repeats a few airlines
    with their aircraft count; an airline the page lists twice becomes one entry
    carrying everything the page said about it.
    """
    soup = BeautifulSoup(html, "html.parser")
    links = soup.find_all("a", href=_is_airline_link)

    if not links:
        _logger.warning(
            "parse_airlines_html: no airline links in response — FR24 page layout may have changed."
        )
        return []

    airlines: Dict[str, Dict] = {}

    for link in links:
        name = _airline_name(link)

        if len(name) < 2:
            continue

        codes = [text for text in _leaf_texts(link, "span") if AIRLINE_CODE_PATTERN.match(text)]
        iata = next((code for code in codes if len(code) == 2), None)
        icao = next((code for code in codes if len(code) == 3), None)

        # Section links ("All") point under /data/airlines/ too; a code tells
        # an airline apart from them.
        if iata is None and icao is None:
            continue

        n_aircrafts = next(
            (int(re.sub(r"\D", "", text)) for text in _leaf_texts(link, "strong") if AIRCRAFT_COUNT_PATTERN.match(text)),
            None,
        )

        airline = airlines.setdefault(
            str(link["href"]), {"Name": name, "ICAO": None, "IATA": None, "n_aircrafts": None},
        )

        for key, value in (("ICAO", icao), ("IATA", iata), ("n_aircrafts", n_aircrafts)):
            if airline[key] is None:
                airline[key] = value

    return list(airlines.values())


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


def parse_inertia_page(payload: Union[bytes, str, Dict]) -> Optional[Dict]:
    """
    Return the Inertia page object (component, props, version) of a FR24 data page.

    Served as HTML, the page keeps it JSON-encoded in the data-page attribute of
    its root element; asked with Core.inertia_headers, FR24 sends it as the body,
    which `request.get_content()` has already decoded into a dict.
    """
    if isinstance(payload, dict):
        page: object = payload
    else:
        root = BeautifulSoup(payload, "html.parser").find(lambda tag: tag.has_attr("data-page"))

        if not isinstance(root, Tag):
            _logger.warning("parse_inertia_page: no data-page attribute in response — FR24 page layout may have changed.")
            return None

        try:
            page = json.loads(str(root["data-page"]))
        except ValueError:
            _logger.warning("parse_inertia_page: data-page is not valid JSON — FR24 page layout may have changed.")
            return None

    if not isinstance(page, dict) or not isinstance(page.get("props"), dict):
        _logger.warning("parse_inertia_page: no page props in response — FR24 page layout may have changed.")
        return None

    return page


def parse_airports_index(payload: Union[bytes, str, Dict]) -> List[Dict]:
    """
    Parse the airports index (Core.airports_data_url) into its countries.

    Each entry has the country "name" as FR24 prints it ("UNITED STATES") and the
    "slug" of its listing page, which is also its Countries enum value.
    """
    page = parse_inertia_page(payload)
    rows = page["props"].get("airportsByCountry") if page is not None else None

    if not isinstance(rows, list):
        _logger.warning('parse_airports_index: no "airportsByCountry" list in response — FR24 page layout may have changed.')
        return []

    countries = []

    for row in rows:
        if not isinstance(row, dict):
            continue

        name = _to_text(row.get("name"))
        slug = country_to_slug(name)

        if slug:
            countries.append({"name": name, "slug": slug})

    return countries


def parse_airports_page(payload: Union[bytes, str, Dict]) -> Tuple[List[Airport], List[str]]:
    """
    Parse a country or state airports page into (airports, state_paths).

    A country with many airports lists its states instead, each with the path of
    its own page; those paths come back for the caller to fetch. The listing has
    no coordinates or altitude: `get_airport(code)` has them for one airport.
    """
    page = parse_inertia_page(payload)

    if page is None:
        return [], []

    props = page["props"]
    country = props.get("country")
    country_name = _to_text(country.get("name")) if isinstance(country, dict) else ""

    rows = props.get("airports")
    states = props.get("states")

    airports = [
        Airport(basic_info={
            "name": _to_text(row.get("name")),
            "icao": _to_text(row.get("icao")),
            "iata": _to_text(row.get("iata")),
            "lat": None,
            "lon": None,
            "alt": None,
            "country": country_name,
        })
        for row in (rows if isinstance(rows, list) else [])
        if isinstance(row, dict)
    ]

    state_paths = [
        state["url"]
        for state in (states if isinstance(states, list) else [])
        if isinstance(state, dict) and isinstance(state.get("url"), str) and state["url"]
    ]

    return airports, state_paths
