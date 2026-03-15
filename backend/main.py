from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AREAS = [
    {
        "area": "Index",
        "style": "trad",
        "rock_type": "granite",
        "overhang": "Low",
        "wet_sensitive": "high",
        "drive_time": 1.2,
    },
    {
        "area": "Leavenworth – Icicle Canyon",
        "style": "trad",
        "rock_type": "granite",
        "overhang": "Low",
        "wet_sensitive": "medium",
        "drive_time": 1.8,
    },
    {
        "area": "Tieton – The Bend",
        "style": "sport",
        "rock_type": "basalt",
        "overhang": "Medium",
        "wet_sensitive": "low",
        "drive_time": 2.6,
    },
    {
        "area": "Vantage – Frenchman Coulee",
        "style": "sport",
        "rock_type": "basalt",
        "overhang": "Medium",
        "wet_sensitive": "low",
        "drive_time": 2.7,
    },
    {
        "area": "Exit 38 – North Bend",
        "style": "sport",
        "rock_type": "volcanic",
        "overhang": "Medium",
        "wet_sensitive": "medium",
        "drive_time": 0.6,
    },
]


def generate_conditions(area):
    rain = random.choice([0, 0, 0, 0.2, 0.4])
    humidity = random.randint(40, 95)
    temperature = random.randint(35, 65)

    dry_score = max(0, 100 - (humidity - 40) - rain * 50)

    if rain > 0.2:
        status = "No Go"
    elif dry_score > 70:
        status = "Go"
    else:
        status = "Maybe"

    return {
        **area,
        "temperature": temperature,
        "humidity": humidity,
        "rain": rain,
        "dry_score": int(dry_score),
        "status": status,
        "updated": datetime.utcnow().isoformat(),
    }


@app.get("/conditions")
def get_conditions():
    results = [generate_conditions(a) for a in AREAS]

    results.sort(key=lambda x: x["dry_score"], reverse=True)

    best = results[0]
    alternates = results[1:4]

    return {
        "best_area": best,
        "alternates": alternates,
        "updated": datetime.utcnow().isoformat(),
    }