import { useEffect, useState } from "react";

function Card({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 14,
        padding: 20,
        marginBottom: 20,
        background: "#ffffff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [maxHours, setMaxHours] = useState(3);
  const [style, setStyle] = useState("all");

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/recommendations?max_hours=${maxHours}&style=${style}`)
      .then((res) => res.json())
      .then((data) => setData(data));
  }, [maxHours, style]);

  if (!data) return <h2 style={{ padding: 40 }}>Loading climbing conditions...</h2>;

  return (
    <div
      style={{
        padding: 40,
        fontFamily: "Arial",
        maxWidth: 900,
        margin: "0 auto",
        background: "#f7f7f7",
        minHeight: "100vh"
      }}
    >
      <h1 style={{ marginBottom: 10 }}>RockRadar 🧗</h1>
      <p style={{ marginTop: 0 }}>
        Home base: <strong>{data.home}</strong>
      </p>

      <div style={{ marginBottom: 30, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <label>
          <strong>Max drive time: </strong>
          <select
            value={maxHours}
            onChange={(e) => setMaxHours(e.target.value)}
            style={{ marginLeft: 10, padding: 8, borderRadius: 8 }}
          >
            <option value="1.5">1.5 hours</option>
            <option value="2">2 hours</option>
            <option value="3">3 hours</option>
            <option value="4">4 hours</option>
          </select>
        </label>

        <label>
          <strong>Climbing style: </strong>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            style={{ marginLeft: 10, padding: 8, borderRadius: 8 }}
          >
            <option value="all">All</option>
            <option value="bouldering">Bouldering</option>
            <option value="sport">Sport</option>
            <option value="trad">Trad</option>
          </select>
        </label>
      </div>

      <Card title="Top Pick">
        <h2>{data.best_area}</h2>

        <p><strong>Drive time:</strong> {data.drive_time} hours</p>
        <p><strong>Best window:</strong> {data.best_window}</p>
        <p><strong>Dry score:</strong> {data.dry_score}</p>

        <h4>Conditions</h4>
        <p>Temperature: {data.temperature}°F</p>
        <p>Rain: {data.rain}</p>
        <p>Wind: {data.wind}</p>

        <h4>Why</h4>
        <p>{data.reason}</p>
      </Card>

      <h2 style={{ marginTop: 40 }}>Alternates</h2>

      {data.alternates.map((alt, index) => (
        <Card key={index} title={alt.area}>
          <p><strong>Drive time:</strong> {alt.drive_time} hours</p>
          <p><strong>Best window:</strong> {alt.best_window}</p>
          <p><strong>Dry score:</strong> {alt.dry_score}</p>
          <p><strong>Why:</strong> {alt.reason}</p>
        </Card>
      ))}
    </div>
  );
}

export default App;