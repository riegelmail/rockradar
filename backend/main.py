import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timedelta
from math import radians, sin, cos, asin, sqrt
from typing import List, Dict, Any, Optional

VALID_STYLES = {"all", "sport", "trad", "bouldering"}

# OpenBeta's public climbing database (openbeta.io) — used to find crags
# anywhere near a user's home instead of maintaining a fixed, hand-curated
# region list. Their cragsNear query hard-caps maxDistance server-side at
# 325,000m (~202 mi); we ask for a bit under that as a safety margin. This
# is well short of the "500 mile radius" originally floated for BC, but it's
# the real ceiling of the free public API — a same-day driving radius is a
# reasonable place to land anyway.
OPENBETA_API_URL = "https://api.openbeta.io"
MAX_RADIUS_MILES = 200
MAX_RADIUS_METERS = int(MAX_RADIUS_MILES * 1609.34)
# OpenBeta's public API can take a while on dense-climbing-area queries
# (confirmed: Denver/Front Range regularly took >8s and got cut off as a
# false "down" signal). 20s is still well inside a page-load spinner and
# gives real requests a fair shot before we fall back to curated-only.
OPENBETA_TIMEOUT_S = 20.0

app = FastAPI()

# No cookies/auth are used, so allow_credentials stays False — combining it
# with a wildcard origin is both unnecessary and a CORS anti-pattern.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Crag data
# ---------------------------------------------------------------------------
# Names must match the keys in the frontend cragPhotos map exactly
# (including the en-dash "–" character).
# sun_exposure (aspect) reconciled from the former backend/crags.json — set by
# a prior dev pass, not independently verified against real crag orientation.
# See SUMMARY.md for the caveat.
CRAGS = [
    {
        "name": "Index – River Boulders",
        "lat": 47.818,
        "lon": -121.558,
        "style": "bouldering",
        "rock_type": "granite",
        "overhang": "Low",
        "wet_sensitive": "high",
        "sun_exposure": "medium",
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
        "sun_exposure": "low",
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
        "sun_exposure": "medium",
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
        "sun_exposure": "high",
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
        "sun_exposure": "high",
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
        "sun_exposure": "low",
        "base_drive_time": 0.6,
    },
    # British Columbia region — base_drive_time is a hand estimate from
    # BASE_HOME (~4.8-4.9 hrs via I-5 + Sea-to-Sky Hwy), not measured the
    # same way as the WA entries above, and doesn't model border-crossing
    # wait time. Good enough for MVP; revisit if/when real crag data (e.g.
    # OpenBeta) replaces this hardcoded list.
    {
        "name": "Squamish – Grand Wall / Apron",
        "lat": 49.6841,
        "lon": -123.1483,
        "style": "trad",
        "rock_type": "granite",
        "overhang": "Low",
        "wet_sensitive": "medium",
        "sun_exposure": "high",
        "base_drive_time": 4.8,
    },
    {
        "name": "Squamish – Smoke Bluffs",
        "lat": 49.7004,
        "lon": -123.1554,
        "style": "sport",
        "rock_type": "granite",
        "overhang": "Medium",
        "wet_sensitive": "medium",
        "sun_exposure": "medium",
        "base_drive_time": 4.8,
    },
    {
        "name": "Squamish – Grand Wall Boulders",
        "lat": 49.6822,
        "lon": -123.1502,
        "style": "bouldering",
        "rock_type": "granite",
        "overhang": "Medium",
        "wet_sensitive": "high",
        "sun_exposure": "low",
        "base_drive_time": 4.9,
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
    """Scale the crag's base drive time by the user's actual home distance.

    Crags with no calibrated base_drive_time (anything pulled live from
    OpenBeta rather than hand-curated) fall back to a flat average-speed
    estimate instead — there's no known reference drive time to scale from.
    """
    home_dist = haversine_miles(home["lat"], home["lon"], crag["lat"], crag["lon"])
    base_drive_time = crag.get("base_drive_time")
    if base_drive_time is None:
        return round(home_dist / 45.0, 1)  # ~45mph average, mixed highway/backroad

    base_dist = haversine_miles(
        BASE_HOME["lat"], BASE_HOME["lon"], crag["lat"], crag["lon"]
    )
    if base_dist < 1:
        return round(home_dist / 50.0, 1)  # ~50mph average
    scaled = base_drive_time * (home_dist / base_dist)
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
      3. days since last measurable rain (drying trend)
      4. aspect / sun exposure
      5. drying signals (humidity, dew point spread, wind, temp)
    """
    current = weather.get("current", {}) or {}
    forecast = weather.get("forecast", []) or []
    wet_mult = wetness_multiplier(crag["wet_sensitive"])
    sun_exposure = crag.get("sun_exposure")

    rain_now = float(current.get("rain_now", 0) or 0)
    rain_24h = float(current.get("rain_24h", 0) or 0)
    humidity = float(current.get("humidity", 60) or 60)
    dew_point = float(current.get("dew_point_f", 40) or 40)
    temperature = float(current.get("temperature_f", 50) or 50)
    wind_mph = float(current.get("wind_mph", 0) or 0)
    days_since_rain = current.get("days_since_rain")
    days_since_rain = int(days_since_rain) if days_since_rain is not None else None
    days_since_rain_capped = bool(current.get("days_since_rain_capped", False))

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

    # Priority 3: multi-day drying trend, from measured daily rain history
    # (not the old single-24h-window guess). Only rewards streaks beyond
    # what rain_24h already penalizes, so the two signals don't double-count.
    if days_since_rain is not None and days_since_rain >= 2 and rain_now == 0:
        bonus = min(8, (days_since_rain - 1) * 2)
        score += bonus
        if days_since_rain >= 3:
            suffix = "+" if days_since_rain_capped else ""
            reasons.append(f"{days_since_rain}{suffix} days since measurable rain")

    # Priority 4: aspect / sun exposure
    if sun_exposure == "high":
        if temperature < 65:
            score += 4
            reasons.append("Sunny aspect helps drying/warmth")
        elif temperature > 85:
            score -= 4
            reasons.append("Sunny aspect adds heat")
    elif sun_exposure == "low":
        recently_wet = rain_now > 0 or rain_24h > 0.5 or (
            days_since_rain is not None and days_since_rain <= 1
        )
        if recently_wet:
            score -= 4
            reasons.append("Shaded aspect — slower to dry")

    # Priority 5: drying signals
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

    # Drying estimate. Prefer real days_since_rain (measured from daily rain
    # history) over the old guess-from-rain_24h heuristic when it's available.
    if rain_now > 0:
        dry_hours = 8 * wet_mult
        confidence = "Low"
        last_rain = "Now"
    elif days_since_rain is not None:
        if days_since_rain == 0:
            dry_hours = max(2, 6 * wet_mult - (wind_mph * 0.2))
            confidence = "Medium"
            last_rain = "Earlier today"
        else:
            hours_since_rain = days_since_rain * 24
            dry_hours = max(0, (6 * wet_mult) - hours_since_rain * 0.15 - (wind_mph * 0.2))
            confidence = "High"
            suffix = "+" if days_since_rain_capped else ""
            last_rain = "Yesterday" if days_since_rain == 1 else f"{days_since_rain}{suffix} days ago"
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
        "conditions_score": score,
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
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class ScoreIn(BaseModel):
    home: HomeIn
    max_hours: float = Field(gt=0, le=24)
    style: str = "all"
    weather: List[Dict[str, Any]]

    @field_validator("style")
    @classmethod
    def validate_style(cls, value: str) -> str:
        if value not in VALID_STYLES:
            raise ValueError(f"style must be one of {sorted(VALID_STYLES)}")
        return value


# ---------------------------------------------------------------------------
# Live crag discovery (OpenBeta) — replaces the old fixed-region model.
# Instead of picking from a named list of regions, we look at whatever's
# actually near the user's home, curated crags first, OpenBeta filling in
# the rest.
# ---------------------------------------------------------------------------
OPENBETA_CRAGS_NEAR_QUERY = """
query CragsNear($lat: Float!, $lng: Float!, $maxDistance: Int!) {
  cragsNear(lnglat: { lat: $lat, lng: $lng }, maxDistance: $maxDistance, includeCrags: true) {
    crags {
      area_name
      totalClimbs
      metadata {
        lat
        lng
        isBoulder
        isDestination
      }
    }
  }
}
"""

# OpenBeta's cragsNear only filters on "is this a leaf area" — that includes
# every buildering wall, campus gym, and one-off boulder someone logged, not
# just real crags. isDestination turned out to be too sparse to rely on (a
# Denver query came back with real destinations like Clear Creek Canyon
# filtered out along with the noise), so the actual quality gate is
# totalClimbs — a wall with a couple dozen logged routes reads very
# differently from a single buildering problem on a campus building.
MIN_CLIMBS_TO_SHOW = 3
MAX_LIVE_CRAGS = 40


def fetch_openbeta_crags(lat: float, lon: float) -> List[Dict[str, Any]]:
    """Live-query OpenBeta for real crags near (lat, lon).

    OpenBeta doesn't carry the qualitative attributes (wet sensitivity,
    aspect, overhang) our curated crags have — those were hand-entered per
    crag. Live results get neutral defaults for those, so their scoring
    leans more heavily on live weather signals alone. That's a real
    trade-off for nationwide coverage vs. the old small curated list.
    """
    try:
        resp = httpx.post(
            OPENBETA_API_URL,
            json={
                "query": OPENBETA_CRAGS_NEAR_QUERY,
                "variables": {"lat": lat, "lng": lon, "maxDistance": MAX_RADIUS_METERS},
            },
            timeout=OPENBETA_TIMEOUT_S,
        )
        resp.raise_for_status()
        payload = resp.json()
    except (httpx.HTTPError, ValueError):
        # OpenBeta being slow/down shouldn't take the whole app down with
        # it — fall back to whatever curated crags are in range.
        return []

    buckets = (payload.get("data") or {}).get("cragsNear") or []
    seen_names = set()
    results: List[Dict[str, Any]] = []
    for bucket in buckets:
        for area in bucket.get("crags") or []:
            if len(results) >= MAX_LIVE_CRAGS:
                return results
            name = area.get("area_name")
            meta = area.get("metadata") or {}
            crag_lat, crag_lon = meta.get("lat"), meta.get("lng")
            if not name or crag_lat is None or crag_lon is None:
                continue
            total_climbs = area.get("totalClimbs") or 0
            if total_climbs < MIN_CLIMBS_TO_SHOW and not meta.get("isDestination"):
                continue
            if name in seen_names:
                continue
            seen_names.add(name)
            results.append(
                {
                    "name": name,
                    "lat": crag_lat,
                    "lon": crag_lon,
                    "style": "bouldering" if meta.get("isBoulder") else "mixed",
                    "rock_type": "unknown",
                    "overhang": "Medium",
                    "wet_sensitive": "medium",
                    "sun_exposure": "medium",
                    "base_drive_time": None,
                    "source": "openbeta",
                }
            )
    return results


def get_nearby_crags(lat: Optional[float], lon: Optional[float]) -> List[Dict[str, Any]]:
    """Curated crags within range of (lat, lon), plus live OpenBeta crags
    filling in everywhere else — deduped so a curated entry always wins
    over an OpenBeta one within ~0.5 mi of it (same crag, different name).
    """
    if lat is None or lon is None:
        return CRAGS

    curated_in_range = [
        c for c in CRAGS if haversine_miles(lat, lon, c["lat"], c["lon"]) <= MAX_RADIUS_MILES
    ]
    live = fetch_openbeta_crags(lat, lon)
    live_deduped = [
        c
        for c in live
        if not any(
            haversine_miles(c["lat"], c["lon"], curated["lat"], curated["lon"]) < 0.5
            for curated in curated_in_range
        )
    ]
    return curated_in_range + live_deduped


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/crags")
def get_crags(lat: float | None = None, lon: float | None = None):
    if (lat is None) != (lon is None):
        raise HTTPException(status_code=400, detail="lat and lon must be provided together")
    crags = get_nearby_crags(lat, lon)
    return [{"name": c["name"], "lat": c["lat"], "lon": c["lon"]} for c in crags]


def _nothing_worth_driving(home_name: str, reason: str) -> Dict[str, Any]:
    return {
        "home": home_name,
        "best_area": "Nothing worth the drive in range.",
        "drive_time": 0,
        "conditions_score": 0,
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
    if not body.weather:
        raise HTTPException(status_code=400, detail="weather list must not be empty")

    home = body.home.model_dump()
    weather_by_name = {w.get("name"): w for w in body.weather}

    scored: List[Dict[str, Any]] = []
    for crag in get_nearby_crags(home["lat"], home["lon"]):
        # "mixed" is OpenBeta's unknown-style placeholder (we don't have
        # per-route type data from them) — never filtered out by style.
        if body.style != "all" and crag["style"] not in (body.style, "mixed"):
            continue
        drive_time = estimate_drive_time(home, crag)
        if drive_time > body.max_hours:
            continue
        w = weather_by_name.get(crag["name"])
        if not w:
            continue
        try:
            entry = score_crag(crag, w)
        except (TypeError, ValueError):
            # Malformed weather payload for this one crag — skip it rather
            # than fail the whole request.
            continue
        entry["drive_time"] = drive_time
        entry["_active_rain"] = float((w.get("current") or {}).get("rain_now", 0) or 0) > 0.05
        scored.append(entry)

    scored.sort(key=lambda x: (x["conditions_score"], -x["drive_time"]), reverse=True)

    if not scored:
        return _nothing_worth_driving(
            home["name"], "Try widening drive time or changing the style."
        )

    # A currently-raining crag is never worth recommending, no matter how
    # high its secondary signals push the score — that would contradict the
    # Go/No-Go promise (a "No Go" crag should never surface as the top pick).
    worthwhile = [
        s
        for s in scored
        if not s["_active_rain"] and (s["go_status"] != "No Go" or s["conditions_score"] >= 35)
    ]
    if not worthwhile:
        return _nothing_worth_driving(
            home["name"], "Everything nearby is wet. Pick a gym today."
        )

    best = worthwhile[0]
    alternates = worthwhile[1:4]
    for entry in [best, *alternates]:
        entry.pop("_active_rain", None)

    return {
        "home": home["name"],
        "best_area": best["area"],
        "drive_time": best["drive_time"],
        "rock_type": best["rock_type"],
        "overhang": best["overhang"],
        "conditions_score": best["conditions_score"],
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
