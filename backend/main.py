from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# allow frontend access
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
    ]@app.get("/api/score")
def score():
    return {
        "best_area": "Index",
        "best_window": "Today 3-7pm",
        "dry_score": 82,
        "temperature": 58,
        "humidity": 60,
        "dew_point": 45,
        "wind": "Light",
        "rain": "None expected",
        "signal_summary": "Conditions look good for climbing.",
        "alternates": ["Leavenworth", "Tieton"]
    }