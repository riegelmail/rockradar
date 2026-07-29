import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from main import CRAGS, app, score_crag

client = TestClient(app)


def dry_weather(name, **overrides):
    current = {
        "temperature_f": 60,
        "humidity": 40,
        "dew_point_f": 30,
        "wind_mph": 5,
        "rain_now": 0,
        "rain_24h": 0,
    }
    current.update(overrides)
    return {
        "name": name,
        "current": current,
        "forecast": [{"day": "Today", "precip": 0}],
    }


def all_dry_weather():
    return [dry_weather(c["name"]) for c in CRAGS]


def test_get_crags_returns_all_known_crags():
    resp = client.get("/api/crags")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == len(CRAGS)
    for entry in data:
        assert set(entry.keys()) == {"name", "lat", "lon"}


def test_score_happy_path_returns_conditions_score_not_dry_score():
    payload = {
        "home": {"name": "Seattle, WA", "lat": 47.6, "lon": -122.3},
        "max_hours": 6,
        "style": "all",
        "weather": all_dry_weather(),
    }
    resp = client.post("/api/score", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "conditions_score" in data
    assert "dry_score" not in data
    assert data["go_status"] in {"Go", "Maybe", "No Go"}
    assert data["alternates"][0]["conditions_score"] if data["alternates"] else True


def test_go_status_never_coincides_with_active_rain():
    for crag in CRAGS:
        weather = dry_weather(crag["name"], rain_now=2.5)
        result = score_crag(crag, weather)
        assert result["go_status"] != "Go", crag["name"]


def test_no_go_forced_when_raining_regardless_of_score():
    crag = CRAGS[0]
    weather = dry_weather(crag["name"], rain_now=0.5, humidity=30, wind_mph=10)
    result = score_crag(crag, weather)
    assert result["go_status"] == "No Go"


def test_empty_weather_returns_nothing_worth_driving():
    payload = {
        "home": {"name": "Seattle, WA", "lat": 47.6, "lon": -122.3},
        "max_hours": 6,
        "style": "all",
        "weather": [],
    }
    resp = client.post("/api/score", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["best_area"] == "Nothing worth the drive in range."
    assert data["conditions_score"] == 0


def test_invalid_max_hours_rejected():
    payload = {
        "home": {"name": "Seattle, WA", "lat": 47.6, "lon": -122.3},
        "max_hours": 0,
        "style": "all",
        "weather": all_dry_weather(),
    }
    resp = client.post("/api/score", json=payload)
    assert resp.status_code == 422


def test_invalid_style_rejected():
    payload = {
        "home": {"name": "Seattle, WA", "lat": 47.6, "lon": -122.3},
        "max_hours": 6,
        "style": "yoga",
        "weather": all_dry_weather(),
    }
    resp = client.post("/api/score", json=payload)
    assert resp.status_code == 422


def test_invalid_home_coordinates_rejected():
    payload = {
        "home": {"name": "Nowhere", "lat": 999, "lon": -122.3},
        "max_hours": 6,
        "style": "all",
        "weather": all_dry_weather(),
    }
    resp = client.post("/api/score", json=payload)
    assert resp.status_code == 422


def test_malformed_weather_entry_does_not_500():
    weather = all_dry_weather()
    weather[0]["current"]["rain_now"] = "not-a-number"
    payload = {
        "home": {"name": "Seattle, WA", "lat": 47.6, "lon": -122.3},
        "max_hours": 6,
        "style": "all",
        "weather": weather,
    }
    resp = client.post("/api/score", json=payload)
    assert resp.status_code == 200


def test_days_since_rain_used_when_present():
    crag = CRAGS[0]
    fresh = score_crag(crag, dry_weather(crag["name"], days_since_rain=0.5))
    stale = score_crag(crag, dry_weather(crag["name"], days_since_rain=10))
    assert fresh["conditions_score"] <= stale["conditions_score"]
    assert "h ago" in fresh["last_rain_event"]


def test_sun_exposure_affects_scoring():
    sunny = dict(CRAGS[0])
    sunny["sun_exposure"] = "high"
    shaded = dict(CRAGS[0])
    shaded["sun_exposure"] = "low"
    weather = dry_weather(CRAGS[0]["name"], rain_24h=3.0)
    sunny_score = score_crag(sunny, weather)["conditions_score"]
    shaded_score = score_crag(shaded, weather)["conditions_score"]
    assert sunny_score >= shaded_score
