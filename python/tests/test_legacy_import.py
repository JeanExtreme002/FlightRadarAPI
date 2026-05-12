# -*- coding: utf-8 -*-
"""Backwards-compatibility tests for the deprecated `FlightRadar24` alias.

The package was renamed to `FlightRadarAPI`, but `FlightRadar24` is kept as
a thin shim so existing user code keeps working through one release. These
tests guard the deprecation contract so that removing the shim later is a
deliberate decision, not an accidental regression.
"""

import importlib
import sys
import warnings


def _reimport(name: str):
    """Drop any cached copy of the module so `import` re-runs side effects."""
    for key in list(sys.modules):
        if key == name or key.startswith(f"{name}."):
            del sys.modules[key]
    return importlib.import_module(name)


class TestLegacyAlias:
    def test_import_emits_deprecation_warning(self):
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            _reimport("FlightRadar24")
        deprecations = [w for w in caught if issubclass(w.category, DeprecationWarning)]
        assert deprecations, "Expected a DeprecationWarning from FlightRadar24 import"
        assert "FlightRadarAPI" in str(deprecations[0].message)

    def test_public_api_is_re_exported(self):
        legacy = _reimport("FlightRadar24")
        new = importlib.import_module("FlightRadarAPI")
        assert legacy.FlightRadar24API is new.FlightRadar24API
        assert legacy.Countries is new.Countries
        assert legacy.__version__ == new.__version__

    def test_submodule_imports_resolve_to_new_package(self):
        _reimport("FlightRadar24")
        # Legacy submodules are registered dynamically via sys.modules in the
        # FlightRadar24 shim, so static analyzers cannot resolve them.
        from FlightRadar24.errors import CloudflareError as LegacyError  # type: ignore[import-not-found]
        from FlightRadarAPI.errors import CloudflareError as NewError
        assert LegacyError is NewError

    def test_nested_subpackage_imports_resolve(self):
        _reimport("FlightRadar24")
        from FlightRadar24.entities.airport import Airport as LegacyAirport  # type: ignore[import-not-found]
        from FlightRadarAPI.entities.airport import Airport as NewAirport
        assert LegacyAirport is NewAirport
