# -*- coding: utf-8 -*-
"""Sphinx configuration for the FlightRadarAPI documentation.

Pages are written in Markdown (MyST) and rendered with the Read the Docs theme.
Nothing is imported from the SDKs, so the build needs none of their dependencies.
"""

import os
import re
from datetime import datetime
from pathlib import Path

# -- Project information -----------------------------------------------------

project = "FlightRadarAPI"
author = "Jean Loui Bernard Silva de Jesus"
copyright = f"{datetime.now().year}, {author}"

# The three SDKs share one version; the Python package is where it is read from.
_init = Path(__file__).parent.parent / "python" / "FlightRadarAPI" / "__init__.py"
release = re.search(r'__version__ = "([^"]+)"', _init.read_text(encoding="utf-8")).group(1)
version = ".".join(release.split(".")[:2])

# -- General configuration ---------------------------------------------------

extensions = [
    "myst_parser",
    "sphinx_copybutton",
    "sphinx_design",
    "sphinxext.opengraph",
]

source_suffix = {".md": "markdown"}

master_doc = "index"
templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

myst_enable_extensions = ["colon_fence", "deflist", "substitution"]
myst_heading_anchors = 3
myst_substitutions = {"release": release}

# -- HTML output -------------------------------------------------------------

html_theme = "sphinx_rtd_theme"
html_title = "FlightRadarAPI"
html_favicon = "_static/favicon.ico"

html_theme_options = {
    "collapse_navigation": False,
    "sticky_navigation": True,
    "navigation_depth": 3,
    "prev_next_buttons_location": "bottom",
    "style_external_links": True,
    # The site is published as a single version: no switchers in the sidebar.
    "version_selector": False,
    "language_selector": False,
}

# "Edit on GitHub" link, plus the data the sidebar repository card reads.
html_context = {
    "display_github": True,
    "github_user": "JeanExtreme002",
    "github_repo": "FlightRadarAPI",
    "github_version": "main",
    "conf_py_path": "/docs/",
}

html_static_path = ["_static"]
html_css_files = ["custom.css"]

# -- Extensions --------------------------------------------------------------

# Read the Docs exports the address the build is served from.
html_baseurl = os.environ.get("READTHEDOCS_CANONICAL_URL", "https://flightradarapi.readthedocs.io/")

ogp_site_url = html_baseurl
ogp_site_name = "FlightRadarAPI"
ogp_image = "_static/logo.png"
ogp_image_alt = "FlightRadarAPI: unofficial SDK for FlightRadar24"
ogp_social_cards = {"enable": False}

copybutton_prompt_text = r">>> |\.\.\. |\$ "
copybutton_prompt_is_regexp = True
