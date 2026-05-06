from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from math import radians, sin, cos, asin, sqrt
from typing import List, Dict, Any

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Crag data
# ---------------------------------------------------------------------------
# Names must match the keys in the frontend cragPhotos map exactly
# (including the en-dash "–" character).
CRAGS = [
    {
        "name": "Index – River Boulders",
        "lat": 47.818,
        "lon": -121.558,
        "style": "bouldering",
        "rock_type": "granite",
        "overhang": "Low",
        "wet_sensitive": "high",
        "base_drive_time": 1.2,
    },
    {
        "name": "Index – Overhung / Hagakure-ish",
        "lat": 47.818,
        "lon": -121.555,
        "style": "sport",
        "rock_type": "granite",
        "overhang": "High",
        "wet_sensitive": "low",
        "base_drive_time": 1.2,
    },
    {
        "name": "Leavenworth – Icicle Canyon",
        "lat": 47.559,
        "lon": -120.762,
        "style": "trad",
        "rock_type": "granite",
        "overhang": "Low",
        "wet_sensitive": "medium",
        "base_drive_time": 1.8,
    },
    {
        "name": "Tieton – The Bend",
        "lat": 46.706,
        "lon": -121.078,
        "style": "sport",
        "rock_type": "basalt",
        "overhang": "Medium",
        "wet_sensitive": "low",
        "base_drive_time": 2.6,
    },
    {
        "name": "Vantage – Frenchman Coulee",
        "lat": 46.962,
        "lon": -119.987,
        "style": "sport",
        "rock_type": "basalt",
        "overhang": "Medium",
        "wet_sensitive": "low",
        "base_drive_time": 2.7,
    },
    {
        "name": "Exit 38 – North Bend",
        "lat": 47.448,
        "lon": -121.664,
        "style": "sport",
        "rock_type": "volcanic",
        "overhang": "Medium",
        "wet_sensitive": "medium",
        "base_drive_time": 0.6,
    },
]

# The base_drive_time values above are measured from this reference home.
BASE_HOME = {"lat": 47.484, "lon": -121.999}  # Mirrormont, WA-ish


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * R * asin(sqrt(a))


def estimate_drive_time(home: Dict[str, float], crag: Dict[str, Any]) -> float:
    """Scale the crag's base drive time by the user's actual home distance."""
    base_dist = haversine_miles(
        BASE_HOME["lat"], BASE_HOME["lon"], crag["lat"], crag["lon"]
    )
    home_dist = haversine_miles(home["lat"], home["lon"], crag["lat"], crag["lon"])
    if base_dist < 1:
        return round(home_dist / 50.0, 1)  # ~50mph average
    scaled = crag["base_drive_time"] * (home_dist / base_dist)
    return round(max(0.1, scaled), 1)


def wetness_multiplier(wet_sensitive: str) -> float:
    return {"low": 0.7, "medium": 1.0, "high": 1.4}.get(wet_sensitive, 1.0)


def forecast_label(precip_mm: float) -> str:
    # Open-Meteo daily precipitation_sum is in mm
    if precip_mm >= 2.0:
        return "Wet"
    if precip_mm >= 0.3:
        return "Drying"
    return "Dry"


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
def score_crag(crag: Dict[str, Any], weather: Dict[str, Any]) -> Dict[str, Any]:
    """
    Conditions priority order:
      1. current rain
      2. forecast rain (next ~48h)
      3. drying signals (humidity, dew point spread, wind, temp)
    """
    current = weather.get("current", {}) or {}
    forecast = weather.get("forecast", []) or []
    wet_mult = wetness_multiplier(crag["wet_sensitive"])

    rain_now = float(current.get("rain_now", 0) or 0)
    rain_24h = float(current.get("rain_24h", 0) or 0)
    humidity = float(current.get("humidity", 60) or 60)
    dew_point = float(current.get("dew_point_f", 40) or 40)
    temperature = float(current.get("temperature_f", 50) or 50)
    wind_mph = float(current.get("wind_mph", 0) or 0)

    score = 100.0
    reasons: List[str] = []

    # Priority 1: current rain
    if rain_now > 0:
        score -= min(60, rain_now * 400) * wet_mult
        reasons.append(f"Raining now ({rain_now:.2f} mm/hr)")

    # 24h rain residual
    if rain_24h > 0.1:
        score -= min(40, rain_24h * 8) * wet_mult
        reasons.append(f"{rain_24h:.1f} mm rain in last 24h")

    # Priority 2: forecast rain (next ~48h)
    near_precip = sum(float(d.get("precip", 0) or 0) for d in forecast[:2])
    if near_precip > 1.0:
        score -= min(25, near_precip * 5) * wet_mult
        reasons.append(f"{near_precip:.1f} mm rain in next 48h")

    # Priority 3: drying signals
    if humidity > 75:
        score -= (humidity - 75) * 0.8
        reasons.append(f"Humidity high ({int(humidity)}%)")
    elif humidity < 50 and rain_now == 0:
        reasons.append(f"Humidity comfortable ({int(humidity)}%)")

    spread = temperature - dew_point
    if spread < 5:
        score -= 10
        reasons.append(f"Dew point close to temp ({spread:.0f}°F spread)")
    elif spread > 15:
        score += 3

    if wind_mph > 7:
        score += min(5, wind_mph * 0.3)
        reasons.append(f"Breezy ({wind_mph:.0f} mph) helps drying")

    if temperature < 35:
        score -= 15
        reasons.append(f"Cold ({temperature:.0f}°F)")
    elif temperature > 85:
        score -= 10
        reasons.append(f"Hot ({temperature:.0f}°F)")

    score = int(max(0, min(100, round(score))))

    # Go status
    if rain_now > 0.05 or score < 50:
        go_status = "No Go"
    elif score >= 75 and rain_now == 0:
        go_status = "Go"
    else:
        go_status = "Maybe"

    # Summary line
    if go_status == "Go":
        summary = "Conditions look solid — send it."
    elif go_status == "Maybe":
        summary = "Some signals mixed — worth a shot, check on arrival."
    else:
        summary = "Conditions not looking great right now."

    # Drying estimate
    if rain_now > 0:
        dry_hours = 8 * wet_mult
        confidence = "Low"
        last_rain = "Now"
    elif rain_24h > 0.5:
        dry_hours = max(2, 6 * wet_mult - (wind_mph * 0.2))
        confidence = "Medium"
        last_rain = f"~{min(24, int(rain_24h * 4))}h ago"
    else:
        dry_hours = 0
        confidence = "High"
        last_rain = "No recent rain"

    if dry_hours <= 0:
        estimated_dry = "Already dry"
    else:
        when = datetime.utcnow() + timedelta(hours=dry_hours)
        estimated_dry = when.strftime("%a %I%p").lstrip("0")

    # Labeled forecast + best window
    labeled_forecast = [
        {**d, "label": forecast_label(float(d.get("precip", 0) or 0))}
        for d in forecast
    ]
    dry_days = [d for d in labeled_forecast if d["label"] == "Dry"]
    best_window = dry_days[0]["day"] if dry_days else "No clear window"

    return {
        "area": crag["name"],
        "rock_type": crag["rock_type"],
        "overhang": crag["overhang"],
        "style": crag["style"],
        "dry_score": score,
        "go_status": go_status,
        "signal_summary": summary,
        "signal_reasons": reasons[:4],
        "temperature": round(temperature),
        "humidity": round(humidity),
        "dew_point": round(dew_point),
        "rain": f"{rain_now:.2f} mm/hr" if rain_now > 0 else "None",
        "wind": f"{int(round(wind_mph))} mph",
        "last_rain_event": last_rain,
        "estimated_dry": estimated_dry,
        "drying_confidence": confidence,
        "best_window": best_window,
        "forecast": labeled_forecast,
    }


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class HomeIn(BaseModel):
    name: str
    lat: float
    lon: float


class ScoreIn(BaseModel):
    home: HomeIn
    max_hours: float
    style: str = "all"
    weather: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/crags")
def get_crags():
    return [{"name": c["name"], "lat": c["lat"], "lon": c["lon"]} for c in CRAGS]


def _nothing_worth_driving(home_name: str, reason: str) -> Dict[str, Any]:
    return {
        "home": home_name,
        "best_area": "Nothing worth the drive in range.",
        "drive_time": 0,
        "dry_score": 0,
        "go_status": "No Go",
        "signal_summary": reason,
        "signal_reasons": [],
        "freshness_text": "Updated just now",
        "temperature": 0,
        "humidity": 0,
        "dew_point": 0,
        "rain": "n/a",
        "wind": "n/a",
        "last_rain_event": "n/a",
        "estimated_dry": "n/a",
        "drying_confidence": "Low",
        "best_window": "n/a",
        "forecast": [],
        "rock_type": "",
        "overhang": "",
        "alternates": [],
    }


@app.post("/api/score")
def post_score(body: ScoreIn):
    home = body.home.dict()
    weather_by_name = {w.get("name"): w for w in body.weather}

    scored: List[Dict[str, Any]] = []
    for crag in CRAGS:
        if body.style != "all" and crag["style"] != body.style:
            continue
        drive_time = estimate_drive_time(home, crag)
        if drive_time > body.max_hours:
            continue
        w = weather_by_name.get(crag["name"])
        if not w:
            continue
        entry = score_crag(crag, w)
        entry["drive_time"] = drive_time
        scored.append(entry)

    scored.sort(key=lambda x: (x["dry_score"], -x["drive_time"]), reverse=True)

    if not scored:
        return _nothing_worth_driving(
            home["name"], "Try widening drive time or changing the style."
        )

    worthwhile = [s for s in scored if s["go_status"] != "No Go" or s["dry_score"] >= 35]
    if not worthwhile:
        return _nothing_worth_driving(
            home["name"], "Everything nearby is wet. Pick a gym today."
        )

    best = worthwhile[0]
    alternates = worthwhile[1:4]

    return {
        "home": home["name"],
        "best_area": best["area"],
        "drive_time": best["drive_time"],
        "rock_type": best["rock_type"],
        "overhang": best["overhang"],
        "dry_score": best["dry_score"],
        "go_status": best["go_status"],
        "signal_summary": best["signal_summary"],
        "signal_reasons": best["signal_reasons"],
        "freshness_text": "Updated just now",
        "temperature": best["temperature"],
        "humidity": best["humidity"],
        "dew_point": best["dew_point"],
        "rain": best["rain"],
        "wind": best["wind"],
        "last_rain_event": best["last_rain_event"],
        "estimated_dry": best["estimated_dry"],
        "drying_confidence": best["drying_confidence"],
        "best_window": best["best_window"],
        "forecast": best["forecast"],
        "alternates": alternates,
    }
