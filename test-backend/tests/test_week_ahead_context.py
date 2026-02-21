"""Tests for context-aware week-ahead: context builder, prompt includes day_context, resilience when API fails."""

import sys
from datetime import date
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.context_service import (
    get_week_context,
    get_week_context_with_availability,
    fetch_holidays_openholidays,
    fetch_weather_open_meteo,
)


def test_context_builder_returns_seven_days():
    start = date(2026, 2, 22)
    contexts = get_week_context(start, 51.5, -0.1, "GB", None)
    assert len(contexts) == 7
    for i, dc in enumerate(contexts):
        assert "date" in dc
        assert "weekday" in dc
        assert "weather" in dc
        assert "holiday" in dc
        assert dc["weather"].get("weather_status") in ("ok", "missing", "error")
        if dc["weather"].get("weather_status") == "ok":
            assert dc["weather"].get("condition_summary") is not None
        assert "holiday_status" in dc["holiday"]
        assert "is_holiday" in dc["holiday"]
        expected_date = date(2026, 2, 22 + i)
        assert dc["date"] == expected_date.isoformat()


def test_holiday_marked_when_mocked():
    """When OpenHolidaysAPI returns a holiday for a date, that day is marked is_holiday with name."""
    import services.context_service as ctx_mod
    ctx_mod._context_cache.clear()
    start = date(2026, 12, 24)
    with patch.object(ctx_mod, "fetch_weather_open_meteo") as mock_weather:
        mock_weather.return_value = {
            "daily": {
                "time": [f"2026-12-{24+i}" for i in range(7)],
                "temperature_2m_max": [5.0] * 7,
                "temperature_2m_min": [0.0] * 7,
                "precipitation_sum": [0.0] * 7,
                "precipitation_probability_max": [0] * 7,
                "weathercode": [0] * 7,
            }
        }
        with patch.object(ctx_mod, "fetch_holidays_openholidays") as mock_holidays:
            mock_holidays.return_value = (
                [
                    {
                        "startDate": "2026-12-25",
                        "endDate": "2026-12-25",
                        "type": "Public",
                        "name": [{"language": "EN", "text": "Christmas Day"}],
                    }
                ],
                None,
            )
            contexts = get_week_context(start, 51.5, -0.1, "DE", None)
    assert len(contexts) == 7
    dec_25 = next((c for c in contexts if c["date"] == "2026-12-25"), None)
    assert dec_25 is not None
    assert dec_25["holiday"]["holiday_status"] == "ok"
    assert dec_25["holiday"]["is_holiday"] is True
    assert "Christmas" in (dec_25["holiday"].get("holiday_name") or "")


def test_weather_api_fail_returns_context_unavailable():
    """When weather fetch fails, get_week_context_with_availability returns context_available=False."""
    import services.context_service as ctx_mod
    start = date(2026, 2, 22)
    ctx_mod._context_cache.clear()
    with patch.object(ctx_mod, "fetch_weather_open_meteo", return_value=None):
        with patch.object(ctx_mod, "fetch_holidays_openholidays", return_value=([], "network error")):
            contexts, metadata = get_week_context_with_availability(start, 51.5, -0.1, "GB", None)
    assert len(contexts) == 7
    assert metadata.get("context_available") is False
    assert metadata.get("weather_ok") is False
    assert "weather" in str(metadata.get("context_errors", [])).lower() or "fetch" in str(metadata.get("context_errors", [])).lower()
    for dc in contexts:
        assert dc["weather"].get("weather_status") == "error"
        assert dc["weather"].get("condition_summary") is None


def test_holiday_api_fail_shows_error_status_and_null_is_holiday():
    """When holiday API fails, each day has holiday_status='error' and is_holiday=null; summary shows 'holiday unknown' not 'not a holiday'."""
    import services.context_service as ctx_mod
    from main import _build_context_summary
    start = date(2026, 2, 22)
    ctx_mod._context_cache.clear()
    with patch.object(ctx_mod, "fetch_weather_open_meteo") as mock_weather:
        mock_weather.return_value = {
            "daily": {
                "time": [f"2026-02-{22+i}" for i in range(7)],
                "temperature_2m_max": [10.0] * 7,
                "temperature_2m_min": [5.0] * 7,
                "precipitation_sum": [0.0] * 7,
                "precipitation_probability_max": [0] * 7,
                "weathercode": [0] * 7,
            }
        }
        with patch.object(ctx_mod, "fetch_holidays_openholidays", return_value=([], "500 Internal Server Error")):
            contexts, metadata = get_week_context_with_availability(start, 51.5, -0.1, "GB", None)
    assert metadata.get("holiday_status") == "error"
    assert metadata.get("holiday_error") == "500 Internal Server Error"
    for dc in contexts:
        h = dc.get("holiday") or {}
        assert h.get("holiday_status") == "error"
        assert h.get("is_holiday") is None
        assert h.get("holiday_error") == "500 Internal Server Error"
    summary = _build_context_summary(contexts)
    assert "holiday unknown" in summary
    assert "not a holiday" not in summary


def test_holiday_success_no_holiday_shows_not_a_holiday():
    """When holiday API returns success and no holiday for the day, holiday_status='ok', is_holiday=false, summary shows 'not a holiday'."""
    from main import _build_context_summary
    import services.context_service as ctx_mod
    start = date(2026, 2, 22)
    ctx_mod._context_cache.clear()
    with patch.object(ctx_mod, "fetch_weather_open_meteo") as mock_weather:
        mock_weather.return_value = {
            "daily": {
                "time": [f"2026-02-{22+i}" for i in range(7)],
                "temperature_2m_max": [10.0] * 7,
                "temperature_2m_min": [5.0] * 7,
                "precipitation_sum": [0.0] * 7,
                "precipitation_probability_max": [0] * 7,
                "weathercode": [0] * 7,
            }
        }
        with patch.object(ctx_mod, "fetch_holidays_openholidays", return_value=([], None)):
            contexts, metadata = get_week_context_with_availability(start, 51.5, -0.1, "GB", None)
    assert metadata.get("holiday_status") == "ok"
    for dc in contexts:
        h = dc.get("holiday") or {}
        assert h.get("holiday_status") == "ok"
        assert h.get("is_holiday") is False
    summary = _build_context_summary(contexts)
    assert "not a holiday" in summary


def test_prompt_builder_includes_day_context():
    """Snapshot-style: main's candidate prompt builder includes day_context JSON."""
    from main import _calendar_candidate_prompt
    day_context = [
        {"date": "2026-02-22", "weekday": "Sunday", "weather": {"weather_status": "ok", "precip_probability": 80, "condition_summary": "Rainy"}, "holiday": {"holiday_status": "ok", "is_holiday": False, "holiday_name": None, "holiday_error": None}},
    ]
    prompt = _calendar_candidate_prompt(
        "2026-02-22",
        __import__("json").dumps(day_context, indent=2),
        "Location source: default (default location).",
        "claude",
    )
    assert "2026-02-22" in prompt
    assert "Rainy" in prompt
    assert "precip_probability" in prompt or "80" in prompt
    assert "DAY CONTEXT" in prompt
    assert "do not invent" in prompt.lower() or "do NOT" in prompt


def test_default_location_weather_ok_context_available():
    """With no lat/lon (use default London), when weather fetch succeeds, context_available is True."""
    import os
    import services.context_service as ctx_mod
    start = date(2026, 2, 22)
    ctx_mod._context_cache.clear()
    # Unset env so we use default location
    old_lat, old_lon = os.environ.pop("USER_LAT", None), os.environ.pop("USER_LON", None)
    try:
        with patch.object(ctx_mod, "fetch_weather_open_meteo") as mock_weather:
            mock_weather.return_value = {
                "daily": {
                    "time": [f"2026-02-{22+i}" for i in range(7)],
                    "temperature_2m_max": [10.0] * 7,
                    "temperature_2m_min": [5.0] * 7,
                    "precipitation_sum": [0.0] * 7,
                    "precipitation_probability_max": [0] * 7,
                    "weathercode": [0] * 7,
                }
            }
            with patch.object(ctx_mod, "fetch_holidays_openholidays", return_value=([], None)):
                contexts, metadata = get_week_context_with_availability(start, None, None, None, None)
    finally:
        if old_lat is not None:
            os.environ["USER_LAT"] = old_lat
        if old_lon is not None:
            os.environ["USER_LON"] = old_lon
    assert metadata.get("location_source") == "default"
    assert metadata.get("used_default_location") is True
    assert metadata.get("weather_ok") is True
    # context_available = weather_ok OR holiday_ok; holiday_ok is True when fetch returns no error
    assert metadata.get("context_available") is True
    # No country provided => we add "holiday unavailable: missing country code"
    assert any("country" in e.lower() for e in (metadata.get("context_errors") or []))


if __name__ == "__main__":
    test_context_builder_returns_seven_days()
    test_holiday_marked_when_mocked()
    test_weather_api_fail_returns_context_unavailable()
    test_holiday_api_fail_shows_error_status_and_null_is_holiday()
    test_holiday_success_no_holiday_shows_not_a_holiday()
    test_prompt_builder_includes_day_context()
    test_default_location_weather_ok_context_available()
    print("All tests passed.")
