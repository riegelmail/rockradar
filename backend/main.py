from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
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

HOME = {
    "name": "Mirrormont",
    "lat": 47.484,
    "lon": -121.999,
}

CRAGS = [
    {
        "name": "Index – River Boulders",
        "style": "bouldering",
        "lat": 47.8216,
        "lon": -121.5704,
        "rock_type": "granite",
        "sun_exposure": "low",
    },
    {
        "name": "Index – Overhung / Hagakure-ish",
        "style": "bouldering",
        "lat": 47.8230,
        "lon": -121.5666,
        "rock_type": "granite",
        "sun_exposure": "medium",
    },
    {
        "name": "Tieton – The Bend",
        "style": "bouldering",
        "lat": 46.642,
        "lon": -120.955,
        "rock_type": "basalt",
        "sun_exposure": "high",
    },
    {
        "name": "Leavenworth – Icicle Canyon",
        "style": "trad",
        "lat": 47.5952,
        "lon": -120.6615,
        "rock_type": "granite",
        "sun_exposure": "high",
    },
    {
        "name": "Exit 38 – North Bend",
        "style": "sport",
        "lat": 47.4362,
        "lon": -121.4151,
        "rock_type": "volcanic",
        "sun_exposure": "low",
    },
    {
        "name": "Vantage – Frenchman Coulee",
        "style": "sport",
        "lat": 46.9490,
        "lon": -119.9875,
        "rock_type": "basalt",
        "sun_exposure": "high",
    },
]

# Fallback values if live weather API is unavailable or rate-limited
FALLBACK_WEATHER = {
    "Index – River Boulders": {
        "temperature_2m": 3.0,
        "wind_speed_10m": 2.0,
        "precipitation": 0.2,
        "rain_last_24h": 1.0,
        "relative_humidity_2m": 88,
        "dew_point_2m": 1.0,
    },
    "Index – Overhung / Hagakure-ish": {
        "temperature_2m": 3.0,
        "wind_speed_10m": 2.0,
        "precipitation": 0.2,
        "rain_last_24h": 1.0,
        "relative_humidity_2m": 88,
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

WEATHER_CACHE = {
    "timestamp": None,
    "data": None,
}
CACHE_TTL_MINUTES = 10


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


def score_crag(crag, weather_tuple):
    weather, rain_24h, source = weather_tuple

    temp_f = c_to_f(weather["temperature_2m"])
    wind_mph = kmh_to_mph(weather["wind_speed_10m"])
    rain_now = weather["precipitation"]
    humidity = weather.get("relative_humidity_2m", 0)
    dew_c = weather.get("dew_point_2m", 0)
    dew_f = c_to_f(dew_c)

    miles = miles_between(HOME["lat"], HOME["lon"], crag["lat"], crag["lon"])
    drive_time = drive_time_hours(miles)

    score = 80

    # Rain matters a lot
    score -= rain_24h * 3
    score -= rain_now * 15

    # Wind can help drying, unless too strong
    if wind_mph <= 8:
        score += wind_mph * 0.4
    else:
        score -= (wind_mph - 8) * 0.5

    # General temperature effect
    if temp_f >= 45:
        score += 3
    elif temp_f <= 34:
        score -= 2

    # Bouldering is extra temperature-sensitive
    if crag["style"] == "bouldering":
        if temp_f <= 50:
            score += 4
        elif temp_f <= 60:
            score += 2
        elif temp_f > 70:
            score -= 4

    # Humidity / friction
    if humidity < 60:
        score += 4
    elif humidity < 75:
        score += 1
    else:
        score -= 5

    # Dew point spread helps friction
    dew_spread = temp_f - dew_f
    if dew_spread >= 10:
        score += 3
    elif dew_spread < 4:
        score -= 4

    # Sun exposure
    if crag.get("sun_exposure") == "high":
        score += 3
    elif crag.get("sun_exposure") == "low":
        score -= 2

    score = max(0, min(100, round(score)))

    delay_hours = rain_24h * 0.3 + rain_now * 2
    best_window = next_daylight_window(delay_hours)

    reason = "Weather and drying conditions evaluated"
    if source == "fallback":
        reason += " (using cached weather data)"
    elif source == "cached":
        reason += " (using cached weather data)"

    return {
        "area": crag["name"],
        "style": crag["style"],
        "rock_type": crag.get("rock_type", "unknown"),
        "drive_time": drive_time,
        "best_window": best_window,
        "dry_score": score,
        "temperature": temp_f,
        "humidity": humidity,
        "dew_point": dew_f,
        "wind": wind_mph,
        "rain": rain_now,
        "reason": reason,
    }


@app.get("/api/recommendations")
def recommendations(
    max_hours: float = Query(default=3),
    style: str = Query(default="all")
):
    weather_data = get_weather_batch(CRAGS)
    results = [score_crag(c, weather_data[i]) for i, c in enumerate(CRAGS)]

    if style != "all":
        results = [r for r in results if r["style"] == style]

    filtered = [r for r in results if r["drive_time"] <= max_hours]

    if not filtered:
        return {
            "home": HOME["name"],
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
            "alternates": [],
        }

    filtered.sort(key=lambda x: x["dry_score"], reverse=True)
    best = filtered[0]

    return {
        "home": HOME["name"],
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
        "alternates": filtered[1:],
    }