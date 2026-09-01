import pytest
from fastapi.testclient import TestClient

import main
from main import CRAGS, app, score_crag

client = TestClient(app)

# Captured before the autouse fixture below stubs main.fetch_openbeta_crags
# out — tests exercising the real parsing/filtering logic call this directly.
real_fetch_openbeta_crags = main.fetch_openbeta_crags


@pytest.fixture(autouse=True)
def no_openbeta_network(monkeypatch):
    """Keep tests offline/deterministic by default — no test should depend
    on OpenBeta actually being reachable or on what it currently returns.
    Tests that want to exercise the live-merge path patch this themselves.
    """
    monkeypatch.setattr(main, "fetch_openbeta_crags", lambda lat, lon: [])


def make_weather(name, **overrides):
    current = {
        "rain_now": 0,
        "rain_24h": 0,
        "humidity": 55,
        "dew_point_f": 40,
        "temperature_f": 60,
        "wind_mph": 3,
        "days_since_rain": 5,
        "days_since_rain_capped": False,
    }
    current.update(overrides)
    return {
        "name": name,
        "current": current,
        "forecast": [
            {"day": "Today", "precip": 0, "high_f": 65, "low_f": 45},
            {"day": "Tomorrow", "precip": 0, "high_f": 66, "low_f": 46},
        ],
    }


def all_weather(**overrides):
    return [make_weather(c["name"], **overrides) for c in CRAGS]


HOME = {"name": "Seattle, WA", "lat": 47.6062, "lon": -122.3321}


# ---------------------------------------------------------------------------
# /api/crags
# ---------------------------------------------------------------------------
def test_get_crags_returns_all_crags_with_name_lat_lon():
    res = client.get("/api/crags")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == len(CRAGS)
    for item in data:
        assert set(item.keys()) == {"name", "lat", "lon"}


# ---------------------------------------------------------------------------
# /api/score - happy path
# ---------------------------------------------------------------------------
def test_post_score_dry_conditions_returns_go():
    res = client.post(
        "/api/score",
        json={"home": HOME, "max_hours": 8, "style": "all", "weather": all_weather()},
    )
    assert res.status_code == 200
    data = res.json()
    assert "conditions_score" in data
    assert "dry_score" not in data
    assert data["go_status"] in {"Go", "Maybe", "No Go"}
    assert isinstance(data["alternates"], list)


def test_post_score_respects_style_filter():
    res = client.post(
        "/api/score",
        json={
            "home": HOME,
            "max_hours": 8,
            "style": "bouldering",
            "weather": all_weather(),
        },
    )
    assert res.status_code == 200
    data = res.json()
    bouldering_names = {c["name"] for c in CRAGS if c["style"] == "bouldering"}
    assert data["best_area"] in bouldering_names


def test_post_score_nothing_in_range_when_max_hours_tiny():
    res = client.post(
        "/api/score",
        json={"home": HOME, "max_hours": 0.01, "style": "all", "weather": all_weather()},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["best_area"] == "Nothing worth the drive in range."
    assert data["go_status"] == "No Go"


def test_post_score_everything_wet_falls_back_to_gym_message():
    res = client.post(
        "/api/score",
        json={
            "home": HOME,
            "max_hours": 8,
            "style": "all",
            "weather": all_weather(rain_now=5, days_since_rain=0),
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["best_area"] == "Nothing worth the drive in range."
    assert "gym" in data["signal_summary"].lower()


# ---------------------------------------------------------------------------
# /api/score - validation
# ---------------------------------------------------------------------------
def test_post_score_rejects_empty_weather():
    res = client.post(
        "/api/score",
        json={"home": HOME, "max_hours": 8, "style": "all", "weather": []},
    )
    assert res.status_code == 400


def test_post_score_rejects_bad_style():
    res = client.post(
        "/api/score",
        json={"home": HOME, "max_hours": 8, "style": "yoga", "weather": all_weather()},
    )
    assert res.status_code == 422


def test_post_score_rejects_negative_max_hours():
    res = client.post(
        "/api/score",
        json={"home": HOME, "max_hours": -1, "style": "all", "weather": all_weather()},
    )
    assert res.status_code == 422


def test_post_score_rejects_out_of_range_lat():
    bad_home = {"name": "Nowhere", "lat": 999, "lon": -122.3}
    res = client.post(
        "/api/score",
        json={"home": bad_home, "max_hours": 8, "style": "all", "weather": all_weather()},
    )
    assert res.status_code == 422


def test_post_score_missing_home_field_returns_422():
    res = client.post(
        "/api/score",
        json={"max_hours": 8, "style": "all", "weather": all_weather()},
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Scoring invariants
# ---------------------------------------------------------------------------
def test_go_status_never_coincides_with_active_rain():
    crag = CRAGS[0]
    for rain_now in [0.01, 0.05, 0.1, 1.0, 5.0]:
        weather = make_weather(crag["name"], rain_now=rain_now)
        result = score_crag(crag, weather)
        assert result["go_status"] != "Go", f"rain_now={rain_now} produced Go"


def test_heavy_rain_now_is_no_go():
    crag = CRAGS[0]
    weather = make_weather(crag["name"], rain_now=5.0)
    result = score_crag(crag, weather)
    assert result["go_status"] == "No Go"


def test_dry_streak_and_low_humidity_can_reach_go():
    crag = CRAGS[0]
    weather = make_weather(
        crag["name"],
        rain_now=0,
        rain_24h=0,
        humidity=40,
        dew_point_f=25,
        temperature_f=65,
        wind_mph=5,
        days_since_rain=6,
    )
    result = score_crag(crag, weather)
    assert result["conditions_score"] >= 75
    assert result["go_status"] == "Go"


def test_score_is_bounded_0_to_100():
    crag = CRAGS[0]
    extreme_wet = make_weather(
        crag["name"], rain_now=50, rain_24h=100, humidity=100, dew_point_f=59,
        temperature_f=60, wind_mph=0, days_since_rain=0,
    )
    result = score_crag(crag, extreme_wet)
    assert 0 <= result["conditions_score"] <= 100

    extreme_dry = make_weather(
        crag["name"], rain_now=0, rain_24h=0, humidity=10, dew_point_f=-10,
        temperature_f=70, wind_mph=30, days_since_rain=10,
    )
    result = score_crag(crag, extreme_dry)
    assert 0 <= result["conditions_score"] <= 100


def test_missing_days_since_rain_falls_back_gracefully():
    crag = CRAGS[0]
    weather = make_weather(crag["name"])
    del weather["current"]["days_since_rain"]
    result = score_crag(crag, weather)
    assert result["last_rain_event"]
    assert result["drying_confidence"] in {"Low", "Medium", "High"}


def test_capped_days_since_rain_shows_plus_suffix():
    crag = CRAGS[0]
    weather = make_weather(crag["name"], days_since_rain=7, days_since_rain_capped=True)
    result = score_crag(crag, weather)
    assert "+" in result["last_rain_event"]


def test_response_never_leaks_internal_active_rain_flag():
    res = client.post(
        "/api/score",
        json={"home": HOME, "max_hours": 8, "style": "all", "weather": all_weather()},
    )
    assert res.status_code == 200
    data = res.json()
    assert "_active_rain" not in data
    for alt in data["alternates"]:
        assert "_active_rain" not in alt


def test_malformed_weather_for_one_crag_does_not_500():
    weather = all_weather()
    # Corrupt one crag's payload with an unparseable numeric field.
    weather[0]["current"]["rain_now"] = "not-a-number"
    res = client.post(
        "/api/score",
        json={"home": HOME, "max_hours": 8, "style": "all", "weather": weather},
    )
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# Live crag discovery (OpenBeta) — replaces the old fixed-region model.
# ---------------------------------------------------------------------------
DENVER = {"name": "Denver, CO", "lat": 39.7392, "lon": -104.9903}


def test_crags_without_lat_lon_returns_curated_list_unfiltered():
    res = client.get("/api/crags")
    assert res.status_code == 200
    assert len(res.json()) == len(CRAGS)


def test_crags_requires_lat_and_lon_together():
    res = client.get("/api/crags", params={"lat": 47.6})
    assert res.status_code == 400


def test_crags_near_home_far_from_curated_list_returns_only_live_results(monkeypatch):
    fake_live = [
        {
            "name": "Clear Creek Canyon",
            "lat": 39.7,
            "lon": -105.3,
            "style": "mixed",
            "rock_type": "unknown",
            "overhang": "Medium",
            "wet_sensitive": "medium",
            "sun_exposure": "medium",
            "base_drive_time": None,
            "source": "openbeta",
        }
    ]
    monkeypatch.setattr(main, "fetch_openbeta_crags", lambda lat, lon: fake_live)

    res = client.get("/api/crags", params={"lat": DENVER["lat"], "lon": DENVER["lon"]})
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Clear Creek Canyon"


def test_crags_dedupes_live_result_close_to_a_curated_crag(monkeypatch):
    curated = CRAGS[0]
    near_duplicate = [
        {
            "name": "Some Other Name For The Same Spot",
            "lat": curated["lat"] + 0.001,
            "lon": curated["lon"] + 0.001,
            "style": "mixed",
            "rock_type": "unknown",
            "overhang": "Medium",
            "wet_sensitive": "medium",
            "sun_exposure": "medium",
            "base_drive_time": None,
            "source": "openbeta",
        }
    ]
    monkeypatch.setattr(main, "fetch_openbeta_crags", lambda lat, lon: near_duplicate)

    res = client.get("/api/crags", params={"lat": HOME["lat"], "lon": HOME["lon"]})
    names = {c["name"] for c in res.json()}
    assert "Some Other Name For The Same Spot" not in names
    assert curated["name"] in names


def test_score_includes_live_openbeta_crag_when_in_range(monkeypatch):
    live_crag = {
        "name": "Clear Creek Canyon",
        "lat": DENVER["lat"] + 0.2,
        "lon": DENVER["lon"] + 0.2,
        "style": "mixed",
        "rock_type": "unknown",
        "overhang": "Medium",
        "wet_sensitive": "medium",
        "sun_exposure": "medium",
        "base_drive_time": None,
        "source": "openbeta",
    }
    monkeypatch.setattr(main, "fetch_openbeta_crags", lambda lat, lon: [live_crag])

    res = client.post(
        "/api/score",
        json={
            "home": DENVER,
            "max_hours": 8,
            "style": "all",
            "weather": [make_weather("Clear Creek Canyon")],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["best_area"] == "Clear Creek Canyon"


def test_score_style_filter_still_includes_openbeta_mixed_crags(monkeypatch):
    live_crag = {
        "name": "Clear Creek Canyon",
        "lat": DENVER["lat"] + 0.2,
        "lon": DENVER["lon"] + 0.2,
        "style": "mixed",
        "rock_type": "unknown",
        "overhang": "Medium",
        "wet_sensitive": "medium",
        "sun_exposure": "medium",
        "base_drive_time": None,
        "source": "openbeta",
    }
    monkeypatch.setattr(main, "fetch_openbeta_crags", lambda lat, lon: [live_crag])

    res = client.post(
        "/api/score",
        json={
            "home": DENVER,
            "max_hours": 8,
            "style": "bouldering",
            "weather": [make_weather("Clear Creek Canyon")],
        },
    )
    assert res.status_code == 200
    # "mixed" (OpenBeta's unknown-style placeholder) is never excluded by
    # a style filter, so this should still surface it.
    assert res.json()["best_area"] == "Clear Creek Canyon"


def test_fetch_openbeta_crags_returns_empty_list_on_network_error(monkeypatch):
    def boom(*args, **kwargs):
        raise main.httpx.ConnectError("no network")

    monkeypatch.setattr(main.httpx, "post", boom)
    assert main.fetch_openbeta_crags(47.6, -122.3) == []


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _openbeta_area(name, total_climbs=0, is_destination=False, is_boulder=False, lat=39.7, lon=-105.2):
    return {
        "area_name": name,
        "totalClimbs": total_climbs,
        "metadata": {"lat": lat, "lng": lon, "isBoulder": is_boulder, "isDestination": is_destination},
    }


def test_fetch_openbeta_crags_filters_out_low_quality_areas(monkeypatch):
    # OpenBeta's cragsNear only filters on "is a leaf area" -- that includes
    # things like campus buildering walls and gym boulders, not just real
    # crags. This is the actual bug we hit in production: Denver came back
    # with hundreds of results like "Sturm Hall" and "REI Denver Flagship
    # Store Boulder" mixed in with real crags. isDestination alone turned
    # out to be too sparse (it excluded real crags too), so the primary
    # gate is a minimum totalClimbs count, with isDestination as a bonus
    # signal for areas that are notable despite a low climb count.
    payload = {
        "data": {
            "cragsNear": [
                {
                    "crags": [
                        _openbeta_area("Clear Creek Canyon", total_climbs=25),
                        _openbeta_area("Small But Notable Wall", total_climbs=1, is_destination=True),
                        _openbeta_area("Sturm Hall", total_climbs=1),
                        _openbeta_area("REI Denver Flagship Store Boulder", total_climbs=0),
                    ]
                }
            ]
        }
    }
    monkeypatch.setattr(main.httpx, "post", lambda *a, **kw: _FakeResponse(payload))

    results = real_fetch_openbeta_crags(39.7, -105.2)
    names = {c["name"] for c in results}
    assert names == {"Clear Creek Canyon", "Small But Notable Wall"}


def test_fetch_openbeta_crags_caps_result_count(monkeypatch):
    many_areas = [
        _openbeta_area(f"Destination {i}", total_climbs=10, lat=39.7 + i * 0.001)
        for i in range(main.MAX_LIVE_CRAGS + 20)
    ]
    payload = {"data": {"cragsNear": [{"crags": many_areas}]}}
    monkeypatch.setattr(main.httpx, "post", lambda *a, **kw: _FakeResponse(payload))

    results = real_fetch_openbeta_crags(39.7, -105.2)
    assert len(results) == main.MAX_LIVE_CRAGS


def test_fetch_openbeta_crags_dedupes_same_area_name_across_buckets(monkeypatch):
    payload = {
        "data": {
            "cragsNear": [
                {"crags": [_openbeta_area("Clear Creek Canyon", total_climbs=25)]},
                {"crags": [_openbeta_area("Clear Creek Canyon", total_climbs=25)]},
            ]
        }
    }
    monkeypatch.setattr(main.httpx, "post", lambda *a, **kw: _FakeResponse(payload))

    results = real_fetch_openbeta_crags(39.7, -105.2)
    assert len(results) == 1
