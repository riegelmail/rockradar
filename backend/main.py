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

with open(CRAGS_FILE, "r", encoding="utf-8") as f:
    CRAGS = json.load(f)

CACHE_TTL_MINUTES = 8

WEATHER_CACHE = {
    "timestamp": None,
    "data": None,
}

FORECAST_CACHE = {}
GEOCODE_CACHE = {}

DRIVE_FACTORS = {
    "Index – River Boulders": 1.2,
    "Index – Overhung / Hagakure-ish": 1.2,
    "Tieton – The Bend": 1.9,
    "Leavenworth – Icicle Canyon": 1.6,
    "Exit 38 – North Bend": 1.2,
    "Vantage – Frenchman Coulee": 1.45,
    "Beacon Rock": 1.45,
    "Smith Rock – Morning Glory Wall": 1.85,
    "Smith Rock – Red Wall": 1.85,
    "Smith Rock – Bouldering": 1.85,
    "Squamish – Grand Wall / Apron": 1.7,
    "Squamish – Chek / Smoke Bluffs Sport": 1.65,
    "Squamish – Grand Wall Boulders": 1.65,
}

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
    "Beacon Rock": {
        "temperature_2m": 7.0,
        "wind_speed_10m": 5.0,
        "precipitation": 0.0,
        "rain_last_24h": 0.2,
        "relative_humidity_2m": 72,
        "dew_point_2m": 2.0,
    },
    "Smith Rock – Morning Glory Wall": {
        "temperature_2m": 9.0,
        "wind_speed_10m": 8.0,
        "precipitation": 0.0,
        "rain_last_24h": 0.0,
        "relative_humidity_2m": 45,
        "dew_point_2m": -2.0,
    },
    "Smith Rock – Red Wall": {
        "temperature_2m": 9.0,
        "wind_speed_10m": 8.0,
        "precipitation": 0.0,
        "rain_last_24h": 0.0,
        "relative_humidity_2m": 45,
        "dew_point_2m": -2.0,
    },
    "Smith Rock – Bouldering": {
        "temperature_2m": 8.0,
        "wind_speed_10m": 7.0,
        "precipitation": 0.0,
        "rain_last_24h": 0.0,
        "relative_humidity_2m": 48,
        "dew_point_2m": -3.0,
    },
    "Squamish – Grand Wall / Apron": {
        "temperature_2m": 5.0,
        "wind_speed_10m": 4.0,
        "precipitation": 0.2,
        "rain_last_24h": 0.8,
        "relative_humidity_2m": 88,
        "dew_point_2m": 3.0,
    },
    "Squamish – Chek / Smoke Bluffs Sport": {
        "temperature_2m": 6.0,
        "wind_speed_10m": 4.0,
        "precipitation": 0.1,
        "rain_last_24h": 0.6,
        "relative_humidity_2m": 84,
        "dew_point_2m": 2.0,
    },
    "Squamish – Grand Wall Boulders": {
        "temperature_2m": 5.0,
        "wind_speed_10m": 3.0,
        "precipitation": 0.2,
        "rain_last_24h": 0.7,
        "relative_humidity_2m": 87,
        "dew_point_2m": 3.0,
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


def drive_time_hours(miles, crag_name):
    base_hours = miles / 55
    factor = DRIVE_FACTORS.get(crag_name, 1.25)
    return round(base_hours * factor, 2)


def overhang_label(value):
    try:
        v = float(value)
    except Exception:
        return "Unknown"

    if v >= 0.7:
        return "High"
    if v >= 0.35:
        return "Medium"
    return "Low"


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


def estimate_drying_time_hours(crag, rain_24h, rain_now, humidity, dew_spread, temp_f):
    hours = 0.0

    hours += rain_24h * 2.4
    hours += rain_now * 18.0

    wet_mult = {"low": 0.8, "medium": 1.15, "high": 1.75}.get(
        crag.get("wet_sensitive", "medium"), 1.15
    )
    rock_mult = {"basalt": 0.75, "granite": 1.2, "volcanic": 1.0}.get(
        crag.get("rock_type", ""), 1.0
    )

    hours *= wet_mult
    hours *= rock_mult

    overhang = crag.get("overhang", 0)
    if overhang >= 0.8:
        hours *= 0.6
    elif overhang >= 0.6:
        hours *= 0.78
    elif overhang <= 0.25:
        hours *= 1.25

    sun = crag.get("sun_exposure", "medium")
    if sun == "high":
        hours *= 0.82
    elif sun == "low":
        hours *= 1.15

    if humidity >= 92:
        hours *= 1.45
    elif humidity >= 85:
        hours *= 1.25
    elif humidity <= 55:
        hours *= 0.9

    if dew_spread < 4:
        hours *= 1.35
    elif dew_spread < 7:
        hours *= 1.15
    elif dew_spread >= 12:
        hours *= 0.88

    if temp_f < 38:
        hours *= 1.15
    elif temp_f > 58:
        hours *= 0.92

    if rain_now > 0.05:
        hours = max(hours, 72.0)

    return round(max(0, hours), 1)


def estimated_dry_text(hours):
    if hours <= 0.5:
        return "Now"
    if hours <= 12:
        return f"{round(hours)} hrs"
    if hours <= 36:
        return f"{round(hours / 24, 1)} days"
    return f"{round(hours / 24)} days"


def drying_confidence_label(rain_24h, rain_now, humidity, dew_spread, source, estimated_dry_hours):
    if rain_now > 0.05:
        return "High"

    if rain_24h <= 0.05 and estimated_dry_hours <= 0.5:
        return "High"

    score = 100

    if source != "live":
        score -= 25
    if rain_24h > 0.5:
        score -= 10
    if humidity > 90:
        score -= 10
    if dew_spread < 4:
        score -= 12

    if score >= 78:
        return "High"
    if score >= 52:
        return "Medium"
    return "Low"


def last_rain_text(rain_24h, rain_now):
    if rain_now > 0.05:
        return "Raining now"
    if rain_24h <= 0.05:
        return "No recent rain"
    if rain_24h <= 0.2:
        return "Light rain in last 24h"
    if rain_24h <= 0.75:
        return "Moderate rain in last 24h"
    return "Heavy rain in last 24h"


def forecast_label_from_wetness(wetness):
    if wetness >= 18:
        return "Wet"
    if wetness >= 7:
        return "Drying"
    return "Dry"


def rock_terrain_wetness_factor(crag):
    factor = 1.0
    factor *= {"basalt": 0.75, "granite": 1.2, "volcanic": 1.0}.get(
        crag.get("rock_type", ""), 1.0
    )
    factor *= {"low": 0.8, "medium": 1.1, "high": 1.3}.get(
        crag.get("wet_sensitive", "medium"), 1.1
    )

    overhang = crag.get("overhang", 0)
    if overhang >= 0.7:
        factor *= 0.72
    elif overhang >= 0.5:
        factor *= 0.88
    elif overhang <= 0.3:
        factor *= 1.18

    return factor


def drying_power_score(crag, avg_temp_f, humidity, dew_spread, wind_mph):
    power = 0.0

    sun = crag.get("sun_exposure", "medium")
    if sun == "high":
        power += 3.0
    elif sun == "medium":
        power += 1.2
    else:
        power -= 1.3

    if avg_temp_f >= 80:
        power += 3.0
    elif avg_temp_f >= 68:
        power += 2.4
    elif avg_temp_f >= 56:
        power += 1.6
    elif avg_temp_f >= 45:
        power += 0.8
    elif avg_temp_f < 38:
        power -= 2.0

    if humidity <= 45:
        power += 3.0
    elif humidity <= 60:
        power += 2.0
    elif humidity <= 75:
        power += 0.5
    elif humidity <= 88:
        power -= 1.8
    else:
        power -= 3.6

    if dew_spread >= 12:
        power += 3.0
    elif dew_spread >= 8:
        power += 2.0
    elif dew_spread >= 5:
        power += 0.5
    else:
        power -= 2.8

    if 6 <= wind_mph <= 18:
        power += 1.0
    elif wind_mph > 22:
        power -= 0.5

    return power


def build_fallback_results(crags):
    results = []
    for crag in crags:
        fallback = FALLBACK_WEATHER.get(
            crag["name"],
            {
                "temperature_2m": 7.0,
                "wind_speed_10m": 5.0,
                "precipitation": 0.0,
                "rain_last_24h": 0.0,
                "relative_humidity_2m": 60,
                "dew_point_2m": 0.0,
            },
        )
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


def build_fallback_forecast(crag):
    fallback = FALLBACK_WEATHER.get(
        crag["name"],
        {
            "temperature_2m": 7.0,
            "wind_speed_10m": 5.0,
            "relative_humidity_2m": 60,
            "dew_point_2m": 0.0,
            "precipitation": 0.0,
            "rain_last_24h": 0.0,
        },
    )

    forecast = []
    wetness = fallback.get("rain_last_24h", 0.0) * 18 * rock_terrain_wetness_factor(crag)
    day_names = ["Today", "Fri", "Sat", "Sun", "Mon"]

    for i, day_name in enumerate(day_names):
        avg_temp_f = c_to_f(fallback["temperature_2m"] + (0.5 * i))
        humidity = max(35, min(95, fallback["relative_humidity_2m"] - (3 * i)))
        dew_f = c_to_f(fallback["dew_point_2m"])
        dew_spread = avg_temp_f - dew_f
        wind_mph = kmh_to_mph(fallback["wind_speed_10m"])
        precip = max(0.0, fallback.get("precipitation", 0.0) - (0.05 * i))

        terrain_factor = rock_terrain_wetness_factor(crag)
        drying_power = drying_power_score(crag, avg_temp_f, humidity, dew_spread, wind_mph)

        wetness = max(0.0, wetness * 0.68 + precip * 18 * terrain_factor - drying_power * 2.2)
        label = forecast_label_from_wetness(wetness)

        forecast.append(
            {
                "day": day_name,
                "score": max(0, min(100, round(100 - wetness * 4))),
                "label": label,
                "wetness": round(wetness, 1),
            }
        )

    return forecast


def get_crag_forecast(crag):
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
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
        "relative_humidity_2m_mean,dew_point_2m_mean,wind_speed_10m_max"
        "&forecast_days=5"
        "&timezone=auto"
    )

    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        data = r.json()

        forecast = []
        terrain_factor = rock_terrain_wetness_factor(crag)
        wetness = 0.0

        for i, day in enumerate(data["daily"]["time"]):
            high_f = c_to_f(data["daily"]["temperature_2m_max"][i])
            low_f = c_to_f(data["daily"]["temperature_2m_min"][i])
            avg_temp_f = round((high_f + low_f) / 2, 1)

            precip = data["daily"]["precipitation_sum"][i]
            humidity = data["daily"]["relative_humidity_2m_mean"][i]
            dew_f = c_to_f(data["daily"]["dew_point_2m_mean"][i])
            dew_spread = avg_temp_f - dew_f
            wind_mph = kmh_to_mph(data["daily"]["wind_speed_10m_max"][i])

            drying_power = drying_power_score(crag, avg_temp_f, humidity, dew_spread, wind_mph)

            wetness = max(
                0.0,
                wetness * 0.68 + precip * 18 * terrain_factor - drying_power * 2.2
            )

            label = forecast_label_from_wetness(wetness)
            score = max(0, min(100, round(100 - wetness * 4)))

            forecast.append(
                {
                    "day": datetime.fromisoformat(day).strftime("%a"),
                    "score": score,
                    "label": label,
                    "wetness": round(wetness, 1),
                }
            )

        FORECAST_CACHE[cache_key] = {"timestamp": now, "data": forecast}
        return forecast

    except Exception:
        fallback_forecast = build_fallback_forecast(crag)
        FORECAST_CACHE[cache_key] = {"timestamp": now, "data": fallback_forecast}
        return fallback_forecast


def build_condition_signal(score, rain_now, rain_24h, estimated_dry_hours, forecast, drying_confidence):
    reasons = []

    if rain_now > 0.05:
        level = "Poor"
        summary = "Skip it for now. The rock is actively wet and this looks like a bad climbing bet."
        reasons.append("It is currently raining at the crag.")
        reasons.append("You are looking at real drying time after the rain stops, not a quick bounce-back.")
        if forecast:
            future_dry_days = sum(1 for day in forecast if day.get("label") == "Dry")
            if future_dry_days >= 2:
                reasons.append("The outlook does improve later, just not right now.")
        return level, summary, reasons

    wet_days = sum(1 for day in forecast if day.get("label") == "Wet")
    drying_days = sum(1 for day in forecast if day.get("label") == "Drying")
    dry_days = sum(1 for day in forecast if day.get("label") == "Dry")

    if score >= 85 and estimated_dry_hours <= 2:
        level = "Good"
        summary = "Worth the drive. Conditions look favorable and the rock should be ready now or very soon."
    elif score >= 60 or drying_days >= 2 or dry_days >= 2:
        level = "Mixed"
        summary = "Proceed with caution. Some terrain could go, but you are still depending on drying progress and timing."
    else:
        level = "Poor"
        summary = "Probably skip it. This looks like a weak option right now unless you are intentionally gambling."

    if rain_24h <= 0.05:
        reasons.append("There has been little to no recent rain.")
    elif rain_24h <= 0.75:
        reasons.append("Recent rain still matters, but it is not an automatic deal-breaker.")
    else:
        reasons.append("Recent rain load is significant and likely still affecting the rock.")

    if estimated_dry_hours <= 0.5:
        reasons.append("The rock should be climbable now if the rest of the signal holds.")
    elif estimated_dry_hours <= 12:
        reasons.append(f"Estimated drying time is about {round(estimated_dry_hours)} hours.")
    else:
        reasons.append(f"Estimated drying time is about {round(estimated_dry_hours / 24, 1)} days.")

    if dry_days >= 3:
        reasons.append("The 5-day outlook is mostly favorable.")
    elif wet_days >= 3:
        reasons.append("The 5-day outlook stays pretty wet.")
    elif drying_days >= 2:
        reasons.append("The next few days look more like a drying trend than fully dry conditions.")

    if drying_confidence == "High":
        reasons.append("Confidence is relatively strong based on the current weather signal.")
    elif drying_confidence == "Low":
        reasons.append("Confidence is softer here, so this call has a bit more uncertainty.")

    return level, summary, reasons


def score_crag(crag, weather_tuple, home):
    weather, rain_24h, source = weather_tuple

    temp_f = c_to_f(weather["temperature_2m"])
    wind_mph = kmh_to_mph(weather["wind_speed_10m"])
    rain_now = weather["precipitation"]
    humidity = weather.get("relative_humidity_2m", 0)
    dew_c = weather.get("dew_point_2m", 0)
    dew_f = c_to_f(dew_c)

    miles = miles_between(home["lat"], home["lon"], crag["lat"], crag["lon"])
    drive_time = drive_time_hours(miles, crag["name"])

    score = 82

    wet_mult = {"low": 0.8, "medium": 1.15, "high": 1.8}.get(
        crag.get("wet_sensitive", "medium"), 1.15
    )
    rock_mult = {"basalt": 0.8, "granite": 1.45, "volcanic": 1.1}.get(
        crag.get("rock_type", ""), 1.0
    )

    score -= rain_24h * 10 * wet_mult * rock_mult
    score -= rain_now * 22 * wet_mult * rock_mult

    if wind_mph <= 8:
        score += wind_mph * 0.4
    else:
        score -= (wind_mph - 8) * 0.5

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

    if humidity < 55:
        score += 4
    elif humidity < 70:
        score += 1
    elif humidity < 85:
        score -= 2
    elif humidity < 90:
        score -= 6
    else:
        score -= 10

    dew_spread = temp_f - dew_f
    if dew_spread >= 12:
        score += 4
    elif dew_spread >= 7:
        score += 1
    elif dew_spread < 4:
        score -= 8

    if crag.get("sun_exposure") == "high":
        score += 3
    elif crag.get("sun_exposure") == "low":
        score -= 2

    if rain_24h > 0.1:
        if crag.get("overhang", 0) >= 0.7:
            score += 5
        elif crag.get("overhang", 0) < 0.35:
            score -= 5

    if crag.get("wet_sensitive") == "high":
        if rain_24h > 0.1:
            score -= 12
        if humidity > 92 and dew_spread < 4:
            score -= 10

    if temp_f <= 36 and rain_now > 0:
        score -= 8

    score = max(0, min(100, round(score)))

    delay_hours = rain_24h * 0.3 + rain_now * 2
    best_window = next_daylight_window(delay_hours)

    estimated_dry_hours = estimate_drying_time_hours(
        crag=crag,
        rain_24h=rain_24h,
        rain_now=rain_now,
        humidity=humidity,
        dew_spread=dew_spread,
        temp_f=temp_f,
    )

    last_rain_event = last_rain_text(rain_24h, rain_now)
    estimated_dry = estimated_dry_text(estimated_dry_hours)
    drying_confidence = drying_confidence_label(
        rain_24h=rain_24h,
        rain_now=rain_now,
        humidity=humidity,
        dew_spread=dew_spread,
        source=source,
        estimated_dry_hours=estimated_dry_hours,
    )

    forecast = get_crag_forecast(crag)
    signal_level, signal_summary, signal_reasons = build_condition_signal(
        score=score,
        rain_now=rain_now,
        rain_24h=rain_24h,
        estimated_dry_hours=estimated_dry_hours,
        forecast=forecast,
        drying_confidence=drying_confidence,
    )

    freshness_text = f"Conditions updated every {CACHE_TTL_MINUTES} minutes"

    return {
        "area": crag["name"],
        "style": crag["style"],
        "rock_type": crag.get("rock_type", "unknown"),
        "overhang": overhang_label(crag.get("overhang", 0)),
        "wet_sensitive": crag.get("wet_sensitive", "medium"),
        "drive_time": drive_time,
        "best_window": best_window,
        "dry_score": score,
        "temperature": temp_f,
        "humidity": humidity,
        "dew_point": dew_f,
        "wind": wind_mph,
        "rain": rain_now,
        "last_rain_event": last_rain_text(rain_24h, rain_now),
        "estimated_dry": estimated_dry,
        "estimated_dry_hours": estimated_dry_hours,
        "drying_confidence": drying_confidence,
        "signal_level": signal_level,
        "signal_summary": signal_summary,
        "signal_reasons": signal_reasons,
        "freshness_text": freshness_text,
        "forecast": forecast,
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
            "last_rain_event": "No recent rain",
            "estimated_dry": "n/a",
            "estimated_dry_hours": 0,
            "drying_confidence": "Low",
            "signal_level": "Poor",
            "signal_summary": "Nothing useful is in range right now. Widen the net or switch styles.",
            "signal_reasons": ["Try increasing max drive time or changing style."],
            "freshness_text": f"Conditions updated every {CACHE_TTL_MINUTES} minutes",
            "forecast": [],
            "alternates": [],
        }

    filtered.sort(key=lambda x: x["dry_score"], reverse=True)
    best = filtered[0]
    alternates = filtered[1:4]

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
        "last_rain_event": best["last_rain_event"],
        "estimated_dry": best["estimated_dry"],
        "estimated_dry_hours": best["estimated_dry_hours"],
        "drying_confidence": best["drying_confidence"],
        "signal_level": best["signal_level"],
        "signal_summary": best["signal_summary"],
        "signal_reasons": best["signal_reasons"],
        "rock_type": best["rock_type"],
        "overhang": best["overhang"],
        "freshness_text": best["freshness_text"],
        "forecast": best["forecast"],
        "alternates": alternates,
    }@app.get("/api/crags")
def get_crags():
    return [
        {"name": "Tieton – The Bend", "lat": 46.74, "lon": -120.95},
        {"name": "Vantage – Frenchman Coulee", "lat": 46.95, "lon": -119.99},
        {"name": "Leavenworth – Icicle Canyon", "lat": 47.56, "lon": -120.66},
        {"name": "Exit 38 – North Bend", "lat": 47.45, "lon": -121.66}
    ]# ---- API health check ----
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---- crag list endpoint ----
@app.get("/api/crags")
def get_crags():
    return [
        {"name": "Index", "lat": 47.8106, "lon": -121.5537, "style": "trad"},
        {"name": "Leavenworth", "lat": 47.5962, "lon": -120.6615, "style": "sport"},
        {"name": "Tieton", "lat": 46.7326, "lon": -121.0706, "style": "sport"},
        {"name": "Exit 38", "lat": 47.4357, "lon": -121.7015, "style": "sport"},
        {"name": "Vantage", "lat": 46.9465, "lon": -119.9870, "style": "sport"},
    ]# health endpoint
@app.get("/api/health")
def health():
    return {"status": "ok"}


# crag list endpoint
@app.get("/api/crags")
def get_crags():
    return [
        {"name": "Index", "lat": 47.8106, "lon": -121.5537, "style": "trad"},
        {"name": "Leavenworth", "lat": 47.5962, "lon": -120.6615, "style": "sport"},
        {"name": "Tieton", "lat": 46.7326, "lon": -121.0706, "style": "sport"},
        {"name": "Exit 38", "lat": 47.4357, "lon": -121.7015, "style": "sport"},
        {"name": "Vantage", "lat": 46.9465, "lon": -119.9870, "style": "sport"},
    ]