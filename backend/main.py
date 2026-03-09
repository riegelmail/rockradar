from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timedelta

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
    {"name": "Index – River Boulders", "style": "bouldering", "lat": 47.8216, "lon": -121.5704},
    {"name": "Index – Overhung / Hagakure-ish", "style": "bouldering", "lat": 47.8230, "lon": -121.5666},
    {"name": "Tieton – The Bend", "style": "bouldering", "lat": 46.642, "lon": -120.955},
    {"name": "Leavenworth – Icicle Canyon", "style": "trad", "lat": 47.5952, "lon": -120.6615},
    {"name": "Exit 38 – North Bend", "style": "sport", "lat": 47.4362, "lon": -121.4151},
    {"name": "Vantage – Frenchman Coulee", "style": "sport", "lat": 46.9490, "lon": -119.9875},
]


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


def get_weather_batch(crags):
    lats = ",".join(str(c["lat"]) for c in crags)
    lons = ",".join(str(c["lon"]) for c in crags)

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lats}"
        f"&longitude={lons}"
        "&current=temperature_2m,wind_speed_10m,precipitation"
        "&hourly=precipitation"
        "&past_days=1"
    )

    r = requests.get(url, timeout=20)
    r.raise_for_status()

    data = r.json()

    results = []

    for i in range(len(crags)):
        current = data["current"][i]
        rain_last_24h = sum(data["hourly"]["precipitation"][i][-24:])
        results.append((current, rain_last_24h))

    return results


def score_crag(crag, weather_tuple):
    weather, rain_24h = weather_tuple

    temp_f = c_to_f(weather["temperature_2m"])
    wind_mph = kmh_to_mph(weather["wind_speed_10m"])
    rain_now = weather["precipitation"]

    miles = miles_between(HOME["lat"], HOME["lon"], crag["lat"], crag["lon"])
    drive_time = drive_time_hours(miles)

    score = 80
    score -= rain_24h * 3
    score -= rain_now * 15

    if wind_mph <= 8:
        score += wind_mph * 0.4
    else:
        score -= (wind_mph - 8) * 0.5

    if temp_f >= 45:
        score += 3
    elif temp_f <= 34:
        score -= 2

    score = max(0, min(100, round(score)))

    delay_hours = rain_24h * 0.3 + rain_now * 2

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
        "reason": "Weather and drying conditions evaluated",
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
        "rain": best["rain"],
        "wind": best["wind"],
        "reason": best["reason"],
        "alternates": filtered[1:],
    }