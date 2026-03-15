import { useEffect, useState } from "react";
import "./App.css";

function StatusPill({ status }) {
  return (
    <div className={`status ${status.replace(" ", "").toLowerCase()}`}>
      {status}
    </div>
  );
}

function CragCard({ data }) {
  return (
    <div className="crag-card">
      <h3>{data.area}</h3>

      <StatusPill status={data.status} />

      <div className="score">{data.dry_score}</div>

      <p>Temp: {data.temperature}°F</p>
      <p>Humidity: {data.humidity}%</p>
      <p>Rain: {data.rain} in</p>
      <p>Rock: {data.rock_type}</p>
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("https://rockradar-backend.onrender.com/conditions")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <div className="loading">Checking the rock...</div>;
  }

  return (
    <div className="app">

      <div className="hero">
        <h1>RockRadar</h1>
        <img src="/hand.jpg" className="hero-hand" />
      </div>

      <div className="main-card">
        <h2>{data.best_area.area}</h2>

        <StatusPill status={data.best_area.status} />

        <p className="summary">
          Conditions updated automatically. Trust the rock, but verify.
        </p>

        <div className="metrics">
          <div>Score: {data.best_area.dry_score}</div>
          <div>Temp: {data.best_area.temperature}°F</div>
          <div>Humidity: {data.best_area.humidity}%</div>
          <div>Rain: {data.best_area.rain} in</div>
        </div>
      </div>

      <h2 className="alt-title">Backup Options</h2>

      <div className="alt-grid">
        {data.alternates.map((a) => (
          <CragCard key={a.area} data={a} />
        ))}
      </div>

    </div>
  );
}

export default App;