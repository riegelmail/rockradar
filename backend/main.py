from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "RockRadar backend running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/crags")
def get_crags():
    return [
        {"name": "Index", "lat": 47.8106, "lon": -121.5537, "style": "trad"},
        {"name": "Leavenworth", "lat": 47.5962, "lon": -120.6615, "style": "sport"},
        {"name": "Tieton", "lat": 46.7326, "lon": -121.0706, "style": "sport"},
        {"name": "Exit 38", "lat": 47.4357, "lon": -121.7015, "style": "sport"},
        {"name": "Vantage", "lat": 46.9465, "lon": -119.9870, "style": "sport"},
    ]


@app.post("/api/score")
def score(payload: dict):
    crags = payload.get("crags", [])

    best_area = crags[0]["name"] if crags else "No crags available"

    return {
        "home": payload.get("home", "Mirrormont, WA"),
        "max_hours": payload.get("max_hours", 3),
        "style": payload.get("style", "all"),
        "best_area": best_area,
        "drive_time": 1.5,
        "best_window": "Today 3 PM – 7 PM",
        "dry_score": 80,
        "temperature": 58,
        "humidity": 60,
        "dew_point": 45,
        "rain": 0,
        "wind": 4,
        "last_rain_event": "No recent rain",
        "estimated_dry": "Now",
        "estimated_dry_hours": 0,
        "drying_confidence": "Medium",
        "signal_level": "Good",
        "signal_summary": "Conditions look decent overall.",
        "signal_reasons": [
            "Little recent rain.",
            "Forecast looks manageable.",
            "This is a temporary scoring stub while backend logic is rebuilt.",
        ],
        "rock_type": "unknown",
        "overhang": "Medium",
        "freshness_text": "Conditions updated recently",
        "forecast": [
            {"day": "Today", "score": 80, "label": "Dry", "wetness": 10},
            {"day": "Fri", "score": 70, "label": "Drying", "wetness": 25},
            {"day": "Sat", "score": 65, "label": "Drying", "wetness": 30},
            {"day": "Sun", "score": 80, "label": "Dry", "wetness": 10},
            {"day": "Mon", "score": 75, "label": "Dry", "wetness": 15},
        ],
        "alternates": [
            {
                "area": "Leavenworth",
                "style": "sport",
                "rock_type": "granite",
                "overhang": "Low",
                "wet_sensitive": "medium",
                "drive_time": 2.0,
                "best_window": "Today 2 PM – 6 PM",
                "dry_score": 72,
                "temperature": 55,
                "humidity": 58,
                "dew_point": 42,
                "wind": 3,
                "rain": 0,
                "last_rain_event": "No recent rain",
                "estimated_dry": "Now",
                "estimated_dry_hours": 0,
                "drying_confidence": "Medium",
                "signal_level": "Fair",
                "signal_summary": "Could be worth a look.",
                "signal_reasons": ["Temporary stub alternate."],
                "forecast": [
                    {"day": "Today", "score": 70, "label": "Drying", "wetness": 20},
                    {"day": "Fri", "score": 60, "label": "Drying", "wetness": 35},
                    {"day": "Sat", "score": 75, "label": "Dry", "wetness": 15},
                    {"day": "Sun", "score": 75, "label": "Dry", "wetness": 15},
                    {"day": "Mon", "score": 80, "label": "Dry", "wetness": 10},
                ],
            }
        ],
    }