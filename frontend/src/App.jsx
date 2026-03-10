import { useEffect, useState } from "react";
import "./App.css";

const cragPhotos = {
  "Index – River Boulders":
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "Index – Overhung / Hagakure-ish":
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "Vantage – Frenchman Coulee":
    "https://images.unsplash.com/photo-1522163182402-834f871fd851",
  "Tieton – The Bend":
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
  "Exit 38 – North Bend":
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
  "Leavenworth – Icicle Canyon":
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
};

function getMapLink(area) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(area)}`;
}

function App() {
  const [data, setData] = useState(null);
  const [maxHours, setMaxHours] = useState(3);
  const [style, setStyle] = useState("all");

  useEffect(() => {
    fetch(
      `https://rockradar-backend.onrender.com/api/recommendations?max_hours=${maxHours}&style=${style}`
    )
      .then((res) => res.json())
      .then((data) => setData(data))
      .catch((err) => console.error(err));
  }, [maxHours, style]);

  if (!data) {
    return <div className="container">Loading RockRadar...</div>;
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="hero-card">
          <div className="hero-text">
            <p className="eyebrow">Climbing conditions</p>
            <h1>RockRadar</h1>

            <div className="hero-meta">
              <span className="meta-pill">Home: {data.home}</span>
              <span className="meta-pill">Top pick: {data.best_area}</span>
            </div>
          </div>

          <div className="hero-icon-wrap">
            <div className="hero-icon">🧗</div>
          </div>
        </div>

        <div className="controls-card">
          <div className="control-group">
            <label>Max drive time</label>
            <select
              value={maxHours}
              onChange={(e) => setMaxHours(e.target.value)}
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

        <div className="top-pick-card">
          <div className="crag-header">
            <img
              className="crag-photo"
              src={
                cragPhotos[data.best_area] ||
                "https://images.unsplash.com/photo-1522163182402-834f871fd851"
              }
              alt={data.best_area}
            />

            <div className="crag-header-text">
              <div className="rank-pill">#1 Top Pick</div>
              <h2 className="crag-name">{data.best_area}</h2>
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
              <span className="stat-label">Dry score</span>
              <span className="stat-value">{data.dry_score}</span>
            </div>
          </div>

          <div className="conditions-card">
            <h3>Conditions</h3>

            <div className="conditions-grid">
              <div className="condition-pill">
                <span>Temp</span>
                <strong>{data.temperature}°F</strong>
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

          <div className="why-card">
            <h3>Why</h3>
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
          <h2 className="alternates-title">Ranked Backups</h2>

          <div className="alternates-grid">
            {data.alternates.map((alt, index) => (
              <div className="alternate-card" key={alt.area}>
                <div className="alternate-top">
                  <img
                    className="alternate-photo"
                    src={
                      cragPhotos[alt.area] ||
                      "https://images.unsplash.com/photo-1522163182402-834f871fd851"
                    }
                    alt={alt.area}
                  />

                  <div className="alternate-header-text">
                    <div className="rank-pill">#{index + 2}</div>
                    <h3>{alt.area}</h3>
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
                    <span>Dry score</span>
                    <strong>{alt.dry_score}</strong>
                  </div>
                </div>

                <p className="alternate-reason">{alt.reason}</p>

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