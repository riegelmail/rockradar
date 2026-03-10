from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timedelta, timezone

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
CRAGS_FILE = BASE_DIR / "crags.json"

HOME_DEFAULT = {
    "name": "Mirrormont, WA",
    "lat": 47.484,
    "lon": -121.999,
}

with open(CRAGS_FILE, "r") as f:
    CRAGS = json.load(f)

CACHE_TTL_MINUTES = 8

WEATHER_CACHE = {
    "timestamp": None,
    "data": None,
}

FORECAST_CACHE = {}
GEOCODE_CACHE = {}

FALLBACK_WEATHER = {
    "Index – River Boulders": {
        "temperature_2m": 3.0,
        "wind_speed_10m": 2.0,
        "precipitation": 0.2,
        "rain_last_24h": 1.0,
        "relative_humidity_2m": 95,
        "dew_point_2m": 1.0,
    },
    "Index – Overhung / Hagakure-ish": {
        "temperature_2m": 3.0,
        "wind_speed_10m": 2.0,
        "precipitation": 0.2,
        "rain_last_24h": 1.0,
        "relative_humidity_2m": 95,
        "dew_point_2m": 1.0,
    },
    "Tieton – The Bend": {
        "temperature_2m": 8.0,
        "wind_speed_10m": 10.0,
        "precipitation": 0.0,
        "rain_last_24h": 0.0,
        "relative_humidity_2m": 50,
        "dew_point_2m": -1.0,
    },
    "Leavenworth – Icicle Canyon": {
        "temperature_2m": 6.0,
        "wind_speed_10m": 6.0,
        "precipitation": 0.0,
        "rain_last_24h": 0.0,
        "relative_humidity_2m": 55,
        "dew_point_2m": -2.0,
    },
    "Exit 38 – North Bend": {
        "temperature_2m": 2.0,
        "wind_speed_10m": 3.0,
        "precipitation": 0.3,
        "rain_last_24h": 1.5,
        "relative_humidity_2m": 92,
        "dew_point_2m": 1.0,
    },
    "Vantage – Frenchman Coulee": {
        "temperature_2m": 11.0,
        "wind_speed_10m": 12.0,
        "precipitation": 0.0,
        "rain_last_24h": 0.0,
        "relative_humidity_2m": 40,
        "dew_point_2m": -3.0,
    },
}


def c_to_f(c):
    return round((c * 9 / 5) + 32, 1)


def kmh_to_mph(kmh):
    return round(kmh * 0.621371, 1)


def miles_between(lat1, lon1, lat2, lon2):
    r = 3958.8
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def drive_time_hours(miles):
    return round(miles / 55, 2)


def resolve_home(home_query):
    if not home_query or not home_query.strip():
        return HOME_DEFAULT

    q = home_query.strip()
    if q in GEOCODE_CACHE:
        return GEOCODE_CACHE[q]

    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": q,
                "format": "jsonv2",
                "limit": 1,
                "countrycodes": "us,ca",
            },
            headers={"User-Agent": "RockRadar/1.0"},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()

        if data:
            home = {
                "name": q,
                "lat": float(data[0]["lat"]),
                "lon": float(data[0]["lon"]),
            }
            GEOCODE_CACHE[q] = home
            return home
    except Exception:
        pass

    return HOME_DEFAULT


def next_daylight_window(delay_hours):
    now = datetime.now()
    start = now + timedelta(hours=delay_hours)

    sunrise = 7
    sunset = 18

    if start.hour < sunrise:
        start = start.replace(hour=sunrise, minute=0, second=0, microsecond=0)

    if start.hour >= sunset:
        start = (start + timedelta(days=1)).replace(
            hour=sunrise, minute=0, second=0, microsecond=0
        )

    end = start + timedelta(hours=4)

    if end.hour > sunset:
        end = end.replace(hour=sunset, minute=0, second=0, microsecond=0)

    return f"{start.strftime('%-I %p')} – {end.strftime('%-I %p')}"


def build_fallback_results(crags):
    results = []
    for crag in crags:
        fallback = FALLBACK_WEATHER[crag["name"]]
        current = {
            "temperature_2m": fallback["temperature_2m"],
            "wind_speed_10m": fallback["wind_speed_10m"],
            "precipitation": fallback["precipitation"],
            "relative_humidity_2m": fallback["relative_humidity_2m"],
            "dew_point_2m": fallback["dew_point_2m"],
        }
        rain_last_24h = fallback["rain_last_24h"]
        results.append((current, rain_last_24h, "fallback"))
    return results


def get_weather_batch(crags):
    now = datetime.now(timezone.utc)

    if WEATHER_CACHE["timestamp"] and WEATHER_CACHE["data"]:
        age = now - WEATHER_CACHE["timestamp"]
        if age < timedelta(minutes=CACHE_TTL_MINUTES):
            return WEATHER_CACHE["data"]

    lats = ",".join(str(c["lat"]) for c in crags)
    lons = ",".join(str(c["lon"]) for c in crags)

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lats}"
        f"&longitude={lons}"
        "&current=temperature_2m,wind_speed_10m,precipitation,relative_humidity_2m,dew_point_2m"
        "&hourly=precipitation"
        "&past_days=1"
    )

    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        data = r.json()

        results = []
        for i in range(len(crags)):
            current = data["current"][i]
            rain_last_24h = sum(data["hourly"]["precipitation"][i][-24:])
            results.append((current, rain_last_24h, "live"))

        WEATHER_CACHE["timestamp"] = now
        WEATHER_CACHE["data"] = results
        return results

    except Exception:
        if WEATHER_CACHE["data"]:
            return [(item[0], item[1], "cached") for item in WEATHER_CACHE["data"]]

        fallback_results = build_fallback_results(crags)
        WEATHER_CACHE["timestamp"] = now
        WEATHER_CACHE["data"] = fallback_results
        return fallback_results


def forecast_score_day(crag, high_c, low_c, precip_sum):
    high_f = c_to_f(high_c)
    low_f = c_to_f(low_c)
    avg_f = round((high_f + low_f) / 2, 1)

    score = 82

    wet_mult = {"low": 0.8, "medium": 1.1, "high": 1.5}.get(
        crag.get("wet_sensitive", "medium"), 1.1
    )
    rock_mult = {"basalt": 0.8, "granite": 1.35, "volcanic": 1.1}.get(
        crag.get("rock_type", ""), 1.0
    )

    score -= precip_sum * 14 * wet_mult * rock_mult

    if crag["style"] == "bouldering":
        if 38 <= avg_f <= 52:
            score += 7
        elif 53 <= avg_f <= 60:
            score += 2
        elif avg_f > 70:
            score -= 8
        elif avg_f < 28:
            score -= 4
    else:
        if 45 <= avg_f <= 68:
            score += 3
        elif avg_f > 82:
            score -= 4

    if crag.get("sun_exposure") == "high":
        score += 2
    elif crag.get("sun_exposure") == "low":
        score -= 2

    if crag.get("overhang") == "high" and precip_sum > 0:
        score += 4
    elif crag.get("overhang") == "low" and precip_sum > 0:
        score -= 4

    score = max(0, min(100, round(score)))
    return score, high_f, low_f


def get_top_pick_forecast(crag):
    cache_key = crag["name"]
    now = datetime.now(timezone.utc)

    if cache_key in FORECAST_CACHE:
        age = now - FORECAST_CACHE[cache_key]["timestamp"]
        if age < timedelta(minutes=CACHE_TTL_MINUTES):
            return FORECAST_CACHE[cache_key]["data"]

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={crag['lat']}"
        f"&longitude={crag['lon']}"
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum"
        "&forecast_days=5"
        "&timezone=auto"
    )

    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        data = r.json()

        forecast = []
        for i, day in enumerate(data["daily"]["time"]):
            score, high_f, low_f = forecast_score_day(
                crag,
                data["daily"]["temperature_2m_max"][i],
                data["daily"]["temperature_2m_min"][i],
                data["daily"]["precipitation_sum"][i],
            )
            forecast.append(
                {
                    "day": datetime.fromisoformat(day).strftime("%a"),
                    "high": high_f,
                    "low": low_f,
                    "precip": round(data["daily"]["precipitation_sum"][i], 2),
                    "score": score,
                }
            )

        FORECAST_CACHE[cache_key] = {"timestamp": now, "data": forecast}
        return forecast

    except Exception:
        return []


def score_crag(crag, weather_tuple, home):
    weather, rain_24h, source = weather_tuple

    temp_f = c_to_f(weather["temperature_2m"])
    wind_mph = kmh_to_mph(weather["wind_speed_10m"])
    rain_now = weather["precipitation"]
    humidity = weather.get("relative_humidity_2m", 0)
    dew_c = weather.get("dew_point_2m", 0)
    dew_f = c_to_f(dew_c)

    miles = miles_between(home["lat"], home["lon"], crag["lat"], crag["lon"])
    drive_time = drive_time_hours(miles)

    score = 82

    wet_mult = {"low": 0.8, "medium": 1.1, "high": 1.5}.get(
        crag.get("wet_sensitive", "medium"), 1.1
    )
    rock_mult = {"basalt": 0.8, "granite": 1.35, "volcanic": 1.1}.get(
        crag.get("rock_type", ""), 1.0
    )

    # Rain is king in the PNW
    score -= rain_24h * 8 * wet_mult * rock_mult
    score -= rain_now * 18 * wet_mult * rock_mult

    # Wind helps drying until it becomes annoying
    if wind_mph <= 8:
        score += wind_mph * 0.4
    else:
        score -= (wind_mph - 8) * 0.5

    # Temperature weighting
    if crag["style"] == "bouldering":
        if 38 <= temp_f <= 52:
            score += 7
        elif 53 <= temp_f <= 60:
            score += 2
        elif temp_f > 70:
            score -= 8
        elif temp_f < 28:
            score -= 4
    else:
        if 45 <= temp_f <= 68:
            score += 3
        elif temp_f > 82:
            score -= 4
        elif temp_f < 34:
            score -= 2

    # Humidity and friction
    if humidity < 55:
        score += 4
    elif humidity < 70:
        score += 1
    elif humidity < 85:
        score -= 2
    else:
        score -= 8

    # Dew point spread
    dew_spread = temp_f - dew_f
    if dew_spread >= 12:
        score += 4
    elif dew_spread >= 7:
        score += 1
    elif dew_spread < 4:
        score -= 6

    # Sun exposure
    if crag.get("sun_exposure") == "high":
        score += 3
    elif crag.get("sun_exposure") == "low":
        score -= 2

    # Overhang matters after rain
    if rain_24h > 0.1:
        if crag.get("overhang") == "high":
            score += 5
        elif crag.get("overhang") == "low":
            score -= 5

    # Strong disqualification for wet-sensitive PNW crags
    if crag.get("wet_sensitive") == "high":
        if rain_24h > 0.25:
            score -= 10
        if humidity > 90 and dew_spread < 4:
            score -= 8

    # Snow / near-freezing wet rock = bad news
    if temp_f <= 36 and rain_now > 0:
        score -= 8

    score = max(0, min(100, round(score)))

    delay_hours = rain_24h * 0.3 + rain_now * 2
    best_window = next_daylight_window(delay_hours)

    reason = (
        "Scored using recent rain, humidity, dew point spread, temperature, "
        "sun exposure, overhang, and rock sensitivity."
    )

    freshness_text = f"Conditions updated every {CACHE_TTL_MINUTES} minutes"

    return {
        "area": crag["name"],
        "style": crag["style"],
        "rock_type": crag.get("rock_type", "unknown"),
        "overhang": crag.get("overhang", "unknown"),
        "wet_sensitive": crag.get("wet_sensitive", "medium"),
        "drive_time": drive_time,
        "best_window": best_window,
        "dry_score": score,
        "temperature": temp_f,
        "humidity": humidity,
        "dew_point": dew_f,
        "wind": wind_mph,
        "rain": rain_now,
        "reason": reason,
        "freshness_text": freshness_text,
    }


@app.get("/api/recommendations")
def recommendations(
    max_hours: float = Query(default=3),
    style: str = Query(default="all"),
    home_query: str = Query(default=""),
):
    home = resolve_home(home_query)
    weather_data = get_weather_batch(CRAGS)
    results = [score_crag(c, weather_data[i], home) for i, c in enumerate(CRAGS)]

    if style != "all":
        results = [r for r in results if r["style"] == style]

    filtered = [r for r in results if r["drive_time"] <= max_hours]

    if not filtered:
        return {
            "home": home["name"],
            "max_hours": max_hours,
            "style": style,
            "best_area": "No crags in range",
            "drive_time": 0,
            "best_window": "",
            "dry_score": 0,
            "temperature": 0,
            "humidity": 0,
            "dew_point": 0,
            "rain": 0,
            "wind": 0,
            "reason": "Try increasing max drive time or changing style.",
            "freshness_text": f"Conditions updated every {CACHE_TTL_MINUTES} minutes",
            "forecast": [],
            "alternates": [],
        }

    filtered.sort(key=lambda x: x["dry_score"], reverse=True)
    best = filtered[0]
    best_crag_data = next(c for c in CRAGS if c["name"] == best["area"])
    forecast = get_top_pick_forecast(best_crag_data)

    return {
        "home": home["name"],
        "max_hours": max_hours,
        "style": style,
        "best_area": best["area"],
        "drive_time": best["drive_time"],
        "best_window": best["best_window"],
        "dry_score": best["dry_score"],
        "temperature": best["temperature"],
        "humidity": best["humidity"],
        "dew_point": best["dew_point"],
        "rain": best["rain"],
        "wind": best["wind"],
        "reason": best["reason"],
        "rock_type": best["rock_type"],
        "overhang": best["overhang"],
        "freshness_text": best["freshness_text"],
        "forecast": forecast,
        "alternates": filtered[1:],
    }