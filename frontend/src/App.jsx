import { useEffect, useState } from "react";
import "./App.css";

import handPhoto from "./assets/crags/hand.jpg";
import exit38Photo from "./assets/crags/exit-38-north-bend.jpg";
import indexHagakurePhoto from "./assets/crags/index-hagakure.jpg";
import indexRiverBouldersPhoto from "./assets/crags/index-river-boulders.jpg";
import leavenworthPhoto from "./assets/crags/leavenworth-icicle-canyon.jpg";
import tietonPhoto from "./assets/crags/tieton-the-bend.jpg";
import vantagePhoto from "./assets/crags/vantage-frenchman-coulee.jpg";

const cragPhotos = {
  "Index – River Boulders": indexRiverBouldersPhoto,
  "Index – Overhung / Hagakure-ish": indexHagakurePhoto,
  "Vantage – Frenchman Coulee": vantagePhoto,
  "Tieton – The Bend": tietonPhoto,
  "Exit 38 – North Bend": exit38Photo,
  "Leavenworth – Icicle Canyon": leavenworthPhoto,
};

const fallbackCragPhoto = handPhoto;

function getMapLink(area) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(area)}`;
}

function scoreClass(score) {
  if (score >= 90) return "score-pill score-green";
  if (score >= 75) return "score-pill score-yellow";
  if (score >= 60) return "score-pill score-orange";
  return "score-pill score-red";
}

function getInitialHome() {
  if (typeof window === "undefined") return "Mirrormont, WA";
  return localStorage.getItem("rockradarHome") || "Mirrormont, WA";
}

function ForecastScoreRow({ forecast, compact = false }) {
  if (!forecast || forecast.length === 0) return null;

  return (
    <div className={`forecast-score-row ${compact ? "compact" : ""}`}>
      {forecast.map((day) => (
        <div className="forecast-score-item" key={day.day}>
          <span className="forecast-score-day">{day.day}</span>
          <span className={scoreClass(day.score)}>{day.score}</span>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [maxHours, setMaxHours] = useState(3);
  const [style, setStyle] = useState("all");
  const [homeInput, setHomeInput] = useState(getInitialHome());
  const [homeBase, setHomeBase] = useState(getInitialHome());

  useEffect(() => {
    fetch(
      `https://rockradar-backend.onrender.com/api/recommendations?max_hours=${maxHours}&style=${style}&home_query=${encodeURIComponent(homeBase)}`
    )
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error(err));
  }, [maxHours, style, homeBase]);

  function applyHomeBase() {
    localStorage.setItem("rockradarHome", homeInput);
    setHomeBase(homeInput);
  }

  if (!data) {
    return <div className="container">Loading RockRadar...</div>;
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="hero-card">
          <div className="hero-text">
            <p className="eyebrow">Find best conditions near you</p>
            <h1>RockRadar</h1>

            <div className="hero-meta">
              <span className="meta-pill">Home: {data.home}</span>
              <span className={`meta-pill ${scoreClass(data.dry_score)}`}>
                Conditions Score: {data.dry_score}
              </span>
            </div>
          </div>

          <div className="hero-icon-wrap">
            <img
              src={handPhoto}
              className="hero-icon"
              alt="climbing hand on rock"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>

        <div className="controls-card">
          <div className="control-group control-group-wide">
            <label>Home base (zip or city/state)</label>
            <div className="home-row">
              <input
                type="text"
                value={homeInput}
                onChange={(e) => setHomeInput(e.target.value)}
                placeholder="98101 or Seattle, WA"
              />
              <button onClick={applyHomeBase}>Update</button>
            </div>
          </div>

          <div className="control-row">
            <div className="control-group">
              <label>Max drive time</label>
              <select
                value={maxHours}
                onChange={(e) => setMaxHours(Number(e.target.value))}
              >
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="3">3 hours</option>
                <option value="4">4 hours</option>
              </select>
            </div>

            <div className="control-group">
              <label>Climbing style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                <option value="all">All</option>
                <option value="sport">Sport</option>
                <option value="trad">Trad</option>
                <option value="bouldering">Bouldering</option>
              </select>
            </div>
          </div>
        </div>

        <div className="top-pick-card">
          <div className="crag-header">
            <img
              className="crag-photo"
              src={cragPhotos[data.best_area] || fallbackCragPhoto}
              alt={data.best_area}
            />

            <div className="crag-header-text">
              <div className="crag-top-row">
                <div className="rank-pill">#1 Top Pick</div>
                <div className={scoreClass(data.dry_score)}>{data.dry_score}</div>
              </div>

              <h2 className="crag-name">{data.best_area}</h2>

              <div className="crag-meta-line">
                <span>{data.rock_type || "unknown rock"}</span>
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-label">Drive</span>
              <span className="stat-value">{data.drive_time} hrs</span>
            </div>

            <div className="stat-box">
              <span className="stat-label">Best window</span>
              <span className="stat-value">{data.best_window}</span>
            </div>

            <div className="stat-box">
              <span className="stat-label">Overhang</span>
              <span className="stat-value">{data.overhang || "n/a"}</span>
            </div>
          </div>

          <div className="conditions-card">
            <div className="section-card-head">
              <h3>Conditions</h3>
              <span className="freshness-text">{data.freshness_text}</span>
            </div>

            <div className="conditions-grid">
              <div className="condition-pill">
                <span>Temp</span>
                <strong>{data.temperature}°F</strong>
              </div>

              <div className="condition-pill">
                <span>Humidity</span>
                <strong>{data.humidity}%</strong>
              </div>

              <div className="condition-pill">
                <span>Dew Pt</span>
                <strong>{data.dew_point}°F</strong>
              </div>

              <div className="condition-pill">
                <span>Rain</span>
                <strong>{data.rain}</strong>
              </div>

              <div className="condition-pill">
                <span>Wind</span>
                <strong>{data.wind}</strong>
              </div>
            </div>
          </div>

          {data.forecast && data.forecast.length > 0 && (
            <div className="forecast-card">
              <div className="section-card-head">
                <h3>5-Day Conditions Forecast</h3>
              </div>

              <ForecastScoreRow forecast={data.forecast} />
            </div>
          )}

          <div className="why-card">
            <div className="section-card-head">
              <h3>Why</h3>
              <a
                href="#"
                className="scoring-link"
                onClick={(e) => e.preventDefault()}
              >
                How scoring works
              </a>
            </div>
            <p>{data.reason}</p>
          </div>

          <a
            className="nav-button"
            href={getMapLink(data.best_area)}
            target="_blank"
            rel="noreferrer"
          >
            Navigate
          </a>
        </div>

        <div className="alternates-section">
          <div className="alternates-header">
            <h2 className="alternates-title">Ranked Backups</h2>
            <p className="alternates-note">
              Top backup options with compact 5-day conditions outlook.
            </p>
          </div>

          <div className="alternates-grid">
            {data.alternates.slice(0, 3).map((alt, index) => (
              <div className="alternate-card" key={alt.area}>
                <div className="alternate-top">
                  <img
                    className="alternate-photo"
                    src={cragPhotos[alt.area] || fallbackCragPhoto}
                    alt={alt.area}
                  />

                  <div className="alternate-header-text">
                    <div className="crag-top-row">
                      <div className="rank-pill">#{index + 2}</div>
                      <div className={scoreClass(alt.dry_score)}>{alt.dry_score}</div>
                    </div>

                    <h3>{alt.area}</h3>

                    <div className="crag-meta-line">
                      <span>{alt.rock_type || "unknown rock"}</span>
                    </div>
                  </div>
                </div>

                <div className="alternate-stats">
                  <div className="mini-stat">
                    <span>Drive</span>
                    <strong>{alt.drive_time} hrs</strong>
                  </div>

                  <div className="mini-stat">
                    <span>Window</span>
                    <strong>{alt.best_window}</strong>
                  </div>

                  <div className="mini-stat">
                    <span>Overhang</span>
                    <strong>{alt.overhang || "n/a"}</strong>
                  </div>
                </div>

                <div className="backup-forecast-block">
                  <span className="backup-forecast-label">5-Day Conditions</span>
                  <ForecastScoreRow forecast={alt.forecast} compact />
                </div>

                <a
                  className="nav-button small"
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
      </div>
    </div>
  );
}

export default App;