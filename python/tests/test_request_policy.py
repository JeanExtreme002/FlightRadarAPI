# -*- coding: utf-8 -*-
"""Policy-level tests for the request layer.

These tests validate **product rules** that must hold regardless of which
HTTP library is in use:

- ``RetryPolicy`` math (exponential backoff, jitter bounds, validation).
- ``_run_with_retry`` semantics (when to retry, when to give up, which
  exception escapes).
- Cloudflare-block detection (HTTP 520, HTTP 403 with ``cf-mitigated``,
  and the deliberate refusal to flag bare 403 from the FR24 origin).

When ``curl_cffi`` is one day swapped for another transport (because FR24's
Cloudflare tuning escalated again), these assertions should remain valid
— only the test doubles in ``_request_doubles`` will need rewiring.
"""

import pytest

from FlightRadar24 import request as request_module
from FlightRadar24.errors import CloudflareError
from FlightRadar24.request import APIRequest, RetryPolicy, _run_with_retry

from _request_doubles import FakeResponse, StubSession


# --- RetryPolicy ------------------------------------------------------------

class TestRetryPolicy:
    def test_rejects_max_attempts_below_one(self):
        with pytest.raises(ValueError):
            RetryPolicy(max_attempts=0)

    def test_rejects_negative_timing_params(self):
        with pytest.raises(ValueError):
            RetryPolicy(base_delay=-1)
        with pytest.raises(ValueError):
            RetryPolicy(max_delay=-1)
        with pytest.raises(ValueError):
            RetryPolicy(jitter=-1)

    def test_sleep_for_grows_exponentially_then_caps(self):
        p = RetryPolicy(max_attempts=10, base_delay=1.0, max_delay=4.0, jitter=0.0)
        assert p.sleep_for(0) == pytest.approx(1.0)
        assert p.sleep_for(1) == pytest.approx(2.0)
        assert p.sleep_for(2) == pytest.approx(4.0)
        # Capped at max_delay.
        assert p.sleep_for(3) == pytest.approx(4.0)
        assert p.sleep_for(10) == pytest.approx(4.0)

    def test_sleep_for_adds_bounded_jitter(self):
        p = RetryPolicy(max_attempts=2, base_delay=1.0, max_delay=10.0, jitter=0.5)
        for _ in range(50):
            delay = p.sleep_for(0)
            assert 1.0 <= delay < 1.5


# --- _run_with_retry --------------------------------------------------------

class TestRunWithRetry:
    def test_no_retry_when_policy_is_none(self):
        calls = {"n": 0}

        def fn():
            calls["n"] += 1
            return "ok"

        assert _run_with_retry(fn, None) == "ok"
        assert calls["n"] == 1

    def test_no_retry_when_max_attempts_is_one(self):
        calls = {"n": 0}

        def fn():
            calls["n"] += 1
            raise CloudflareError("blocked", response=None)

        with pytest.raises(CloudflareError):
            _run_with_retry(fn, RetryPolicy(max_attempts=1))
        assert calls["n"] == 1

    def test_retries_cloudflare_then_succeeds(self, monkeypatch):
        monkeypatch.setattr(request_module.time, "sleep", lambda _: None)

        calls = {"n": 0}

        def fn():
            calls["n"] += 1
            if calls["n"] < 3:
                raise CloudflareError("blocked", response=None)
            return "ok"

        result = _run_with_retry(fn, RetryPolicy(max_attempts=5, base_delay=0, jitter=0))
        assert result == "ok"
        assert calls["n"] == 3

    def test_raises_last_error_after_exhausting_attempts(self, monkeypatch):
        monkeypatch.setattr(request_module.time, "sleep", lambda _: None)

        errors = [
            CloudflareError("first", response=None),
            CloudflareError("second", response=None),
            CloudflareError("third", response=None),
        ]
        seq = iter(errors)

        def fn():
            raise next(seq)

        with pytest.raises(CloudflareError) as exc_info:
            _run_with_retry(fn, RetryPolicy(max_attempts=3, base_delay=0, jitter=0))
        assert "third" in str(exc_info.value)

    def test_does_not_retry_non_transient_errors(self, monkeypatch):
        monkeypatch.setattr(request_module.time, "sleep", lambda _: None)

        calls = {"n": 0}

        def fn():
            calls["n"] += 1
            raise ValueError("permanent")

        with pytest.raises(ValueError):
            _run_with_retry(fn, RetryPolicy(max_attempts=5, base_delay=0, jitter=0))
        assert calls["n"] == 1


# --- Cloudflare detection ---------------------------------------------------
#
# These tests touch APIRequest because the rule lives there, but the rule
# itself is product policy (not transport detail): "what counts as a CF block?"
# When the transport changes, only StubSession needs rewriting — the
# assertions remain.

class TestCloudflareDetection:
    def test_520_raises_cloudflare_error(self):
        session = StubSession(FakeResponse(status_code=520))
        with pytest.raises(CloudflareError):
            APIRequest("https://example.com", session=session)  # type: ignore[arg-type]

    def test_403_with_cf_mitigated_raises_cloudflare_error(self):
        session = StubSession(FakeResponse(
            status_code=403,
            headers={"cf-mitigated": "challenge"},
        ))
        with pytest.raises(CloudflareError):
            APIRequest("https://example.com", session=session)  # type: ignore[arg-type]

    def test_bare_403_without_cf_header_is_not_cloudflare(self):
        """A 403 from the FR24 origin (e.g. premium endpoint) must not be
        misreported as a Cloudflare block — fixed by commit caa68ff."""
        session = StubSession(FakeResponse(
            status_code=403,
            # Present on every FR24 response, but on its own does not imply
            # Cloudflare *acted*.
            headers={"server": "cloudflare"},
        ))
        with pytest.raises(RuntimeError) as exc_info:
            APIRequest("https://example.com", session=session)  # type: ignore[arg-type]
        assert not isinstance(exc_info.value, CloudflareError)

    def test_403_in_allowed_codes_is_swallowed_even_with_cf_header(self):
        """``get_airline_logo`` / ``get_country_flag`` opt into 403 meaning
        'asset not found on CDN'. With the caller's opt-in, detection must
        not fire — the caller is explicitly handling this status."""
        session = StubSession(FakeResponse(
            status_code=403,
            headers={"cf-mitigated": "challenge"},
        ))
        req = APIRequest(
            "https://example.com",
            session=session,  # type: ignore[arg-type]
            allowed_error_codes=[403],
        )
        assert req.get_status_code() == 403
