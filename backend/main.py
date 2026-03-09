from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timedelta

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://rockradar.vercel.app",
        "https://rockradar-git-main-riegelmail.vercel.app",
    ],
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
        "dry_bonus": 8,
        "dry_speed_hours": 2,
        "shade_penalty": 2,
        "rain_sensitivity": 1.0,
        "reason": "More exposed; dries faster when rain stops"
    },
    {
        "name": "Index – Overhung / Hagakure-ish",
        "style": "bouldering",
        "lat": 47.8230,
        "lon": -121.5666,
        "dry_bonus": 5,
        "dry_speed_hours": 4,
        "shade_penalty": 5,
        "rain_sensitivity": 1.2,
        "reason": "Steeper terrain stays drier but dries slowly after storms"
    },
    {
        "name": "Tieton – The Bend",
        "style": "bouldering",
        "lat": 46.642,
        "lon": -120.955,
        "dry_bonus": 15,
        "dry_speed_hours": 1,
        "shade_penalty": 0,
        "rain_sensitivity": 0.6,
        "reason": "Sunny and dry side; great fallback when west side is wet"
    },
    {
        "name": "Leavenworth – Icicle Canyon",
        "style": "trad",
        "lat": 47.5952,
        "lon": -120.6615,
        "dry_bonus": 10,
        "dry_speed_hours": 2,
        "shade_penalty": 1,
        "rain_sensitivity": 0.8,
        "reason": "Granite dries quickly and sees good sun"
    },
    {
        "name": "Exit 38 – North Bend",
        "style": "sport",
        "lat": 47.4362,
        "lon": -121.4151,
        "dry_bonus": 2,
        "dry_speed_hours": 5,
        "shade_penalty": 6,
        "rain_sensitivity": 1.3,
        "reason": "Forest crag that dries slowly after rain"
    },
    {
        "name": "Vantage – Frenchman Coulee",
        "style": "sport",
        "lat": 46.9490,
        "lon": -119.9875,
        "dry_bonus": 18,
        "dry_speed_hours": 0,
        "shade_penalty": 0,
        "rain_sensitivity": 0.4,
        "reason": "Basalt desert crag that stays dry most of the year"
    }
]

WEATHER_CACHE = {}
CACHE_MINUTES = 10


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

    sunrise_hour = 7
    sunset_hour = 18

    if start.hour < sunrise_hour:
        start = start.replace(hour=sunrise_hour, minute=0, second=0, microsecond=0)

    if start.hour >= sunset_hour:
        start = (start + timedelta(days=1)).replace(
            hour=sunrise_hour, minute=0, second=0, microsecond=0
        )

    end = start + timedelta(hours=4)

    if end.hour > sunset_hour:
        end = end.replace(hour=sunset_hour, minute=0, second=0, microsecond=0)

    return f"{start.strftime('%-I %p')} – {end.strftime('%-I %p')}"


def get_weather(lat, lon):
    cache_key = f"{lat},{lon}"
    now = datetime.utcnow()

    if cache_key in WEATHER_CACHE:
        cached = WEATHER_CACHE[cache_key]
        if now - cached["timestamp"] < timedelta(minutes=CACHE_MINUTES):
            return cached["current"], cached["rain_last_24h"]

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,wind_speed_10m,precipitation"
        f"&hourly=precipitation"
        f"&past_days=1"
    )

    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        data = r.json()

        current = data["current"]
        rain_last_24h = sum(data["hourly"]["precipitation"][-24:])

        WEATHER_CACHE[cache_key] = {
            "timestamp": now,
            "current": current,
            "rain_last_24h": rain_last_24h,
        }

        return current, rain_last_24h

    except Exception:
        if cache_key in WEATHER_CACHE:
            cached = WEATHER_CACHE[cache_key]
            return cached["current"], cached["rain_last_24h"]
        raise


def score_crag(crag):
    weather, rain_24h = get_weather(crag["lat"], crag["lon"])

    temp_f = c_to_f(weather["temperature_2m"])
    wind_mph = kmh_to_mph(weather["wind_speed_10m"])
    rain_now = weather["precipitation"]

    miles = miles_between(HOME["lat"], HOME["lon"], crag["lat"], crag["lon"])
    drive_time = drive_time_hours(miles)

    score = 85
    score -= rain_24h * 3.5 * crag["rain_sensitivity"]
    score -= rain_now * 18

    if wind_mph <= 8:
        score += wind_mph * 0.4
    else:
        score -= (wind_mph - 8) * 0.4

    score += crag["dry_bonus"]
    score -= crag["shade_penalty"]

    if temp_f >= 45:
        score += 3
    elif temp_f <= 34:
        score -= 2

    score = max(0, min(100, round(score)))

    delay_hours = crag["dry_speed_hours"]

    if rain_24h > 8:
        delay_hours += 6
    elif rain_24h > 5:
        delay_hours += 4
    elif rain_24h > 2:
        delay_hours += 2
    elif rain_24h > 0.5:
        delay_hours += 1

    if rain_now > 0:
        delay_hours += 2

    best_window = next_daylight_window(delay_hours)

    return {
        "area": crag["name"],
        "style": crag["style"],
        "drive_time": drive_time,
        "best_window": best_window,
        "dry_score": score,
        "temperature": temp_f,
        "wind": wind_mph,
        "rain": rain_now,
        "reason": crag["reason"],
    }


@app.get("/api/recommendations")
def recommendations(
    max_hours: float = Query(default=3),
    style: str = Query(default="all")
):
    try:
        results = [score_crag(c) for c in CRAGS]

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
                "rain": 0,
                "wind": 0,
                "reason": "Try increasing max drive time or changing style.",
                "alternates": []
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
            "rain": best["rain"],
            "wind": best["wind"],
            "reason": best["reason"],
            "alternates": filtered[1:]
        }

    except Exception as e:
        return {
            "home": HOME["name"],
            "max_hours": max_hours,
            "style": style,
            "best_area": "Weather temporarily unavailable",
            "drive_time": 0,
            "best_window": "",
            "dry_score": 0,
            "temperature": 0,
            "rain": 0,
            "wind": 0,
            "reason": f"Backend error: {str(e)}",
            "alternates": []
        }