// Secondary data, deliberately de-emphasized: small, muted, grouped. This is
// the numeric detail (temp / humidity / wind / drying) that used to dominate
// the old layout — now it sits quietly below the photo and status badge.
export default function ConditionStats({ scored }) {
  if (!scored) return null;

  const conditions = [
    { label: "Temp", value: `${scored.temperature}°F` },
    { label: "Humidity", value: `${scored.humidity}%` },
    { label: "Dew pt", value: `${scored.dew_point}°F` },
    { label: "Wind", value: scored.wind },
    { label: "Rain", value: scored.rain },
  ];

  const drying = [
    { label: "Last rain", value: scored.last_rain_event || "n/a" },
    { label: "Dry by", value: scored.estimated_dry || "n/a" },
    { label: "Confidence", value: scored.drying_confidence || "Low" },
  ];

  return (
    <div className="condition-stats">
      <div className="stat-group">
        <span className="stat-group-title">Conditions</span>
        <dl className="stat-list">
          {conditions.map((item) => (
            <div className="stat-item" key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="stat-group">
        <span className="stat-group-title">Drying outlook</span>
        <dl className="stat-list">
          {drying.map((item) => (
            <div className="stat-item" key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
