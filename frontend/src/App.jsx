import { useEffect, useState } from "react";
import "./App.css";

import handPhoto from "./assets/crags/hand.jpg";
import exit38Photo from "./assets/crags/exit-38-north-bend.jpg";
import indexHagakurePhoto from "./assets/crags/index-hagakure.jpg";
import indexRiverBouldersPhoto from "./assets/crags/index-river-boulders.jpg";
import leavenworthPhoto from "./assets/crags/leavenworth-icicle-canyon.jpg";
import tietonPhoto from "./assets/crags/tieton-the-bend.jpg";
import vantagePhoto from "./assets/crags/vantage-frenchman-coulee.jpg";

import beaconRockPhoto from "./assets/crags/beacon-rock.jpg";

import smithMorningGloryPhoto from "./assets/crags/smith-morning-glory-wall.jpg";
import smithRedWallPhoto from "./assets/crags/smith-red-wall.jpg";
import smithBoulderingPhoto from "./assets/crags/smith-bouldering.jpg";

import squamishApronPhoto from "./assets/crags/squamish-grand-wall-apron.jpg";
import squamishSportPhoto from "./assets/crags/squamish-chek-smoke-bluffs.jpg";
import squamishBouldersPhoto from "./assets/crags/squamish-grand-wall-boulders.jpg";

const cragPhotos = {
  "Index – River Boulders": indexRiverBouldersPhoto,
  "Index – Overhung / Hagakure-ish": indexHagakurePhoto,
  "Tieton – The Bend": tietonPhoto,
  "Leavenworth – Icicle Canyon": leavenworthPhoto,
  "Exit 38 – North Bend": exit38Photo,
  "Vantage – Frenchman Coulee": vantagePhoto,

  "Beacon Rock": beaconRockPhoto,

  "Smith Rock – Morning Glory Wall": smithMorningGloryPhoto,
  "Smith Rock – Red Wall": smithRedWallPhoto,
  "Smith Rock – Bouldering": smithBoulderingPhoto,

  "Squamish – Grand Wall / Apron": squamishApronPhoto,
  "Squamish – Chek / Smoke Bluffs Sport": squamishSportPhoto,
  "Squamish – Grand Wall Boulders": squamishBouldersPhoto,
};

const fallbackCragPhoto = handPhoto;

function getMapLink(area) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    area
  )}`;
}

function scoreClass(score) {
  if (score >= 90) return "score-pill score-green";
  if (score >= 75) return "score-pill score-yellow";
  if (score >= 60) return "score-pill score-orange";
  return "score-pill score-red";
}

function confidenceClass(confidence) {
  if (confidence === "High") return "score-pill score-green";
  if (confidence === "Medium") return "score-pill score-yellow";
  return "score-pill score-red";
}

function outlookClass(label) {
  if (label === "Dry") return "score-pill score-green";
  if (label === "Drying") return "score-pill score-yellow";
  return "score-pill score-red";
}

function OutlookRow({ forecast }) {
  if (!forecast) return null;

  return (
    <div className="forecast-row">
      {forecast.map((day) => (
        <div className="forecast-item" key={day.day}>
          <span className="forecast-day">{day.day}</span>
          <span className={outlookClass(day.label)}>{day.label}</span>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("https://rockradar-backend.onrender.com/api/recommendations")
      .then((res) => res.json())
      .then((json) => setData(json));
  }, []);

  if (!data) {
    return <div className="container">Loading RockRadar...</div>;
  }

  return (
    <div className="container">
      <div className="hero">
        <h1>RockRadar</h1>
        <img src={handPhoto} className="logo" alt="climbing hand" />
      </div>

      <div className="top-pick">
        <img
          src={cragPhotos[data.best_area] || fallbackCragPhoto}
          alt={data.best_area}
          className="crag-photo"
        />

        <h2>{data.best_area}</h2>

        <div className="stats">
          <span className={scoreClass(data.dry_score)}>
            Score {data.dry_score}
          </span>

          <span className={confidenceClass(data.drying_confidence)}>
            Confidence {data.drying_confidence}
          </span>
        </div>

        <div className="conditions">
          <p>Temp: {data.temperature}°F</p>
          <p>Humidity: {data.humidity}%</p>
          <p>Dewpoint: {data.dew_point}°F</p>
          <p>Rain: {data.rain}</p>
          <p>Wind: {data.wind}</p>
        </div>

        <div className="drying">
          <p>Last rain: {data.last_rain_event}</p>
          <p>Estimated dry: {data.estimated_dry}</p>
        </div>

        <h3>5-Day Outlook</h3>

        <OutlookRow forecast={data.forecast} />

        <a
          href={getMapLink(data.best_area)}
          target="_blank"
          rel="noreferrer"
          className="nav-button"
        >
          Navigate
        </a>
      </div>

      <div className="alternates">
        <h2>Backup Areas</h2>

        {data.alternates.map((alt) => (
          <div key={alt.area} className="alternate-card">
            <img
              src={cragPhotos[alt.area] || fallbackCragPhoto}
              alt={alt.area}
            />

            <h3>{alt.area}</h3>

            <span className={scoreClass(alt.dry_score)}>
              Score {alt.dry_score}
            </span>

            <OutlookRow forecast={alt.forecast} />

            <a
              href={getMapLink(alt.area)}
              target="_blank"
              rel="noreferrer"
            >
              Navigate
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;