import { useEffect, useState } from "react";
import "./App.css";

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
      .catch((err) => console.error("API error:", err));
  }, [maxHours, style]);

  if (!data) return <div>Loading...</div>;

  return (
    <div className="container">
      <h1>RockRadar 🧗</h1>

      <p>Home base: {data.home}</p>

      <div className="controls">
        <label>
          Max drive time:
          <select
            value={maxHours}
            onChange={(e) => setMaxHours(e.target.value)}
          >
            <option value={1}>1 hour</option>
            <option value={2}>2 hours</option>
            <option value={3}>3 hours</option>
            <option value={4}>4 hours</option>
          </select>
        </label>

        <label>
          Climbing style:
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="all">All</option>
            <option value="sport">Sport</option>
            <option value="trad">Trad</option>
            <option value="bouldering">Bouldering</option>
          </select>
        </label>
      </div>

      <div className="card">
        <h2>Top Pick</h2>

        <h3>{data.best_area}</h3>

        <p>
          <strong>Drive time:</strong> {data.drive_time} hours
        </p>

        <p>
          <strong>Best window:</strong> {data.best_window}
        </p>

        <p>
          <strong>Dry score:</strong> {data.dry_score}
        </p>

        <h4>Conditions</h4>

        <p>Temperature: {data.temperature}°F</p>

        <p>Rain: {data.rain}</p>

        <p>Wind: {data.wind}</p>

        <h4>Why</h4>

        <p>{data.reason}</p>
      </div>

      <h2 style={{ marginTop: 40 }}>Alternates</h2>

      {data.alternates.map((alt, index) => (
        <div className="card" key={index}>
          <h3>{alt.area}</h3>

          <p>
            <strong>Drive time:</strong> {alt.drive_time} hours
          </p>

          <p>
            <strong>Best window:</strong> {alt.best_window}
          </p>

          <p>
            <strong>Dry score:</strong> {alt.dry_score}
          </p>

          <p>
            <strong>Why:</strong> {alt.reason}
          </p>
        </div>
      ))}
    </div>
  );
}

export default App;