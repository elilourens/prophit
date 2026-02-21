"""
Context builder for week-ahead predictions: weather (Open-Meteo) and public holidays (OpenHolidaysAPI).
Provides a 7-day day_context list and in-memory cache (10 min) with resilient fallback.
Returns metadata: weather_ok, holiday_ok, context_available, location_source, used_default_location, context_errors.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import date, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Open-Meteo: no API key. Daily forecast 7 days.
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
# OpenHolidaysAPI: no API key. Public holidays by country and date range.
OPENHOLIDAYS_URL = "https://openholidaysapi.org/PublicHolidays"

# Default location when none provided (London)
DEFAULT_LAT = 51.5
DEFAULT_LON = -0.1

# In-memory cache: key -> (payload, timestamp)
_context_cache: dict[str, tuple[list[dict], float]] = {}
CACHE_TTL_SECONDS = 10 * 60  # 10 minutes


def _weathercode_to_summary(code: int) -> str:
    """Map WMO weather code to short condition summary."""
    if code is None:
        return "Unknown"
    c = int(code)
    if c == 0:
        return "Clear"
    if c in (1, 2, 3):
        return "Partly cloudy"
    if c in (45, 48):
        return "Foggy"
    if c in (51, 53, 55, 56, 57):
        return "Drizzle"
    if c in (61, 63, 65, 66, 67):
        return "Rainy"
    if c in (71, 73, 75, 77):
        return "Snow"
    if c in (80, 81, 82):
        return "Rain showers"
    if c in (85, 86):
        return "Snow showers"
    if c in (95, 96, 99):
        return "Thunderstorm"
    return "Cloudy"


def fetch_weather_open_meteo(
    lat: float,
    lon: float,
    start_date: date,
    end_date: date,
) -> dict[str, Any] | None:
    """
    Fetch daily forecast from Open-Meteo for the date range.
    Returns daily arrays: time, temperature_2m_max, temperature_2m_min,
    precipitation_sum, precipitation_probability_max, weathercode.
    """
    try:
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode",
            "timezone": "auto",
            "forecast_days": (end_date - start_date).days + 1,
        }
        with httpx.Client(timeout=10.0) as client:
            r = client.get(OPEN_METEO_URL, params=params)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        logger.warning("Open-Meteo fetch failed: %s", e)
        return None


def fetch_holidays_openholidays(
    country_code: str,
    start_date: date,
    end_date: date,
    subdivision_code: str | None = None,
    language_iso: str = "EN",
) -> tuple[list[dict], str | None]:
    """
    Fetch public holidays from OpenHolidaysAPI for the country and date range.
    Returns (list of holidays, None) on success, or ([], error_message) on failure.
    Logs countryCode, subdivision, date range before call; on non-200 logs status + body snippet.
    """
    if not country_code or len(country_code) != 2:
        return [], "missing country code"
    params = {
        "countryIsoCode": country_code.upper(),
        "languageIsoCode": language_iso,
        "validFrom": start_date.isoformat(),
        "validTo": end_date.isoformat(),
    }
    if subdivision_code:
        params["subdivisionCode"] = subdivision_code
    logger.info(
        "OpenHolidaysAPI request: baseUrl=%s countryCode=%s subdivision=%s validFrom=%s validTo=%s",
        OPENHOLIDAYS_URL,
        params["countryIsoCode"],
        params.get("subdivisionCode") or "(none)",
        params["validFrom"],
        params["validTo"],
    )
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(OPENHOLIDAYS_URL, params=params, headers={"accept": "application/json"})
            if r.status_code != 200:
                body_snippet = (r.text or "")[:200]
                logger.warning(
                    "OpenHolidaysAPI non-200: status=%s body=%s",
                    r.status_code,
                    body_snippet,
                )
                return [], f"API returned {r.status_code}"
            r.raise_for_status()
            data = r.json()
            return (data if isinstance(data, list) else []), None
    except Exception as e:
        logger.warning("OpenHolidaysAPI fetch failed: %s", e)
        return [], str(e)


def _holiday_for_date(holidays: list[dict], d: date) -> dict:
    """
    Return holiday block for one day when holiday_status is "ok".
    Keys: holiday_status="ok", is_holiday (bool), holiday_name (str|null), holiday_error (null).
    """
    d_str = d.isoformat()
    for h in holidays:
        start = h.get("startDate") or ""
        end = h.get("endDate") or start
        if start <= d_str <= end:
            name_list = h.get("name") or []
            name = None
            for n in name_list:
                if isinstance(n, dict) and n.get("text"):
                    name = n.get("text")
                    break
            if not name and name_list:
                name = name_list[0].get("text") if isinstance(name_list[0], dict) else str(name_list[0])
            return {
                "holiday_status": "ok",
                "is_holiday": True,
                "holiday_name": name or "Public Holiday",
                "holiday_error": None,
            }
    return {
        "holiday_status": "ok",
        "is_holiday": False,
        "holiday_name": None,
        "holiday_error": None,
    }


def _holiday_block_unavailable(status: str, error: str | None) -> dict:
    """Holiday block when fetch was missing or failed. is_holiday is null."""
    return {
        "holiday_status": status,
        "is_holiday": None,
        "holiday_name": None,
        "holiday_error": error,
    }


def _build_day_context_list(
    start_date: date,
    weather_data: dict | None,
    holidays_data: list[dict] | None,
    holiday_status: str = "ok",
    holiday_error: str | None = None,
) -> list[dict]:
    """
    Build 7 day_context dicts. Each day has:
    - weather: weather_status ("ok"|"error"), precip_probability, precip_mm, temp_min_c, temp_max_c, condition_summary (all nullable when status!="ok")
    - holiday: holiday_status ("ok"|"missing"|"error"), is_holiday (bool|null), holiday_name, holiday_error
    """
    end_date = start_date + timedelta(days=6)
    week_dates = [start_date + timedelta(days=i) for i in range(7)]
    weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weather_status_day = "ok" if weather_data is not None else "error"
    daily = (weather_data or {}).get("daily") or {}
    times = daily.get("time") or []
    temp_max = daily.get("temperature_2m_max") or []
    temp_min = daily.get("temperature_2m_min") or []
    precip_sum = daily.get("precipitation_sum") or []
    precip_prob_max = daily.get("precipitation_probability_max") or []
    # Open-Meteo JSON uses weather_code; support weathercode for tests/mocks
    weathercode = daily.get("weather_code") or daily.get("weathercode") or []

    result = []
    for i, d in enumerate(week_dates):
        d_str = d.isoformat()
        weekday = weekday_names[d.weekday()]
        w_idx = next((j for j, t in enumerate(times) if t == d_str), None)
        if weather_status_day == "ok" and w_idx is not None:
            weather = {
                "weather_status": "ok",
                "precip_probability": int(precip_prob_max[w_idx]) if precip_prob_max else None,
                "precip_mm": float(precip_sum[w_idx]) if precip_sum else None,
                "temp_min_c": float(temp_min[w_idx]) if temp_min else None,
                "temp_max_c": float(temp_max[w_idx]) if temp_max else None,
                "condition_summary": _weathercode_to_summary(weathercode[w_idx] if weathercode else None),
            }
        else:
            # No data for this day: "missing" when fetch succeeded, else "error"
            day_weather_status = "missing" if weather_status_day == "ok" else weather_status_day
            weather = {
                "weather_status": day_weather_status,
                "precip_probability": None,
                "precip_mm": None,
                "temp_min_c": None,
                "temp_max_c": None,
                "condition_summary": None,
            }
        if holiday_status == "ok" and holidays_data is not None:
            holiday = _holiday_for_date(holidays_data, d)
        else:
            holiday = _holiday_block_unavailable(holiday_status, holiday_error)
        result.append({"date": d_str, "weekday": weekday, "weather": weather, "holiday": holiday})
    return result


def get_week_context(
    start_date: date,
    lat: float,
    lon: float,
    country_code: str,
    subdivision_code: str | None = None,
) -> list[dict]:
    """
    Build 7 day_context objects for the week starting at start_date.
    Uses cache. On API failure, returns context with placeholder/unknown.
    """
    cache_key = f"{lat:.4f}_{lon:.4f}_{country_code}_{subdivision_code or ''}_{start_date.isoformat()}"
    now = time.time()
    if cache_key in _context_cache:
        payload, ts = _context_cache[cache_key]
        if now - ts < CACHE_TTL_SECONDS:
            return payload
        del _context_cache[cache_key]

    end_date = start_date + timedelta(days=6)
    weather_data = fetch_weather_open_meteo(lat, lon, start_date, end_date)
    holidays_data, h_err = fetch_holidays_openholidays(country_code, start_date, end_date, subdivision_code)
    if not isinstance(holidays_data, list):
        holidays_data = []
    if h_err:
        holiday_status = "missing" if "missing" in (h_err or "").lower() else "error"
        holiday_error = h_err
    else:
        holiday_status = "ok"
        holiday_error = None

    result = _build_day_context_list(
        start_date, weather_data, holidays_data, holiday_status, holiday_error
    )
    _context_cache[cache_key] = (result, now)
    return result


def get_week_context_with_availability(
    start_date: date,
    lat: float | None,
    lon: float | None,
    country_code: str | None,
    subdivision_code: str | None = None,
) -> tuple[list[dict], dict]:
    """
    Return (day_context_list, metadata).
    metadata: weather_ok, holiday_ok, context_available, location_source, used_default_location, context_errors.
    context_available := weather_ok OR holiday_ok (either provides real signal).
    """
    context_errors: list[str] = []
    user_lat = os.getenv("USER_LAT")
    user_lon = os.getenv("USER_LON")
    user_country = (os.getenv("USER_COUNTRY") or "").strip().upper()[:2] or None

    use_lat = float(lat) if lat is not None else (float(user_lat) if user_lat else DEFAULT_LAT)
    use_lon = float(lon) if lon is not None else (float(user_lon) if user_lon else DEFAULT_LON)
    use_country = (country_code or user_country or "").strip().upper()[:2] or None

    if lat is not None and lon is not None:
        location_source = "request"
    elif user_lat and user_lon:
        location_source = "env"
    else:
        location_source = "default"

    used_default_location = (
        (use_lat == DEFAULT_LAT and use_lon == DEFAULT_LON)
        and not (user_lat and user_lon)
    )

    # Holiday fetch: only when we have a country
    holidays_data: list[dict] = []
    holiday_ok = False
    holiday_status: str = "missing"
    holiday_error: str | None = None
    if not use_country:
        context_errors.append("holiday unavailable: missing country code")
        holiday_status = "missing"
        holiday_error = "missing country code"
    else:
        try:
            end_date = start_date + timedelta(days=6)
            holidays_data, err = fetch_holidays_openholidays(
                use_country, start_date, end_date, subdivision_code
            )
            if err:
                context_errors.append(f"holiday: {err}")
                holiday_status = "missing" if "missing" in (err or "").lower() else "error"
                holiday_error = err
            else:
                holiday_ok = True
                holiday_status = "ok"
                holiday_error = None
        except Exception as e:
            context_errors.append(f"holiday: {str(e)}")
            holiday_status = "error"
            holiday_error = str(e)

    # Weather fetch: always (we have lat/lon from request, env, or default)
    weather_data = None
    try:
        end_date = start_date + timedelta(days=6)
        weather_data = fetch_weather_open_meteo(use_lat, use_lon, start_date, end_date)
    except Exception as e:
        context_errors.append(f"weather: {str(e)}")

    if weather_data is None:
        context_errors.append("weather: fetch failed")
    contexts = _build_day_context_list(
        start_date, weather_data, holidays_data, holiday_status, holiday_error
    )

    # Context used only when at least one day has weather or holiday status "ok" (attempted doesn't count)
    def _day_has_ok(d: dict) -> bool:
        w = d.get("weather") or {}
        h = d.get("holiday") or {}
        return w.get("weather_status") == "ok" or h.get("holiday_status") == "ok"

    context_used = any(_day_has_ok(c) for c in contexts)
    weather_ok = any((c.get("weather") or {}).get("weather_status") == "ok" for c in contexts)
    # holiday_ok already set above from fetch result

    metadata = {
        "weather_ok": weather_ok,
        "holiday_ok": holiday_ok,
        "holiday_status": holiday_status,
        "holiday_error": holiday_error,
        "context_available": context_used,
        "context_used": context_used,
        "location_source": location_source,
        "used_default_location": used_default_location,
        "context_errors": context_errors,
    }
    return contexts, metadata
