import { useState } from "react";
import StatusBadge from "./StatusBadge";
import ForecastRow from "./ForecastRow";
import { getCragPhoto, getMapLink } from "../lib/conditions";
import { scoreClass, confidenceClass } from "../lib/status";

// A ranked crag card. Reads photo-first, status-second; all the numeric
// weather detail is grouped and visually de-emphasised below the fold.
export default function CragCard({ crag, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  const secondary = [
    { label: "Temp", value: `${crag.temperature}°F` },
    { label: "Humidity", value: `${crag.humidity}%` },
    { label: "Dew pt", value: `${crag.dew_point}°F` },
    { label: "Wind", value: crag.wind },
    { label: "Rain", value: crag.rain },
  ];

  return (
    <article className="crag-card">
      <div className="crag-card-photo-wrap">
        <img
          className="crag-card-photo"
          src={getCragPhoto(crag.area)}
          alt={crag.area}
          loading="lazy"
        />
        <div className="crag-card-photo-overlay">
          <StatusBadge goStatus={crag.go_status} size="lg" />
          <span className="rank-chip">#{crag.rank}</span>
        </div>
      </div>

      <div className="crag-card-body">
        <div className="crag-card-headline">
          <h3 className="crag-card-name">{crag.area}</h3>
          <span className={scoreClass(crag.conditions_score)}>
            {crag.conditions_score}
          </span>
        </div>

        <p className="crag-card-summary">{crag.signal_summary}</p>

        <div className="crag-card-facts">
          <span className="fact-strong">{crag.drive_time} hr drive</span>
          <span className="fact-dot">·</span>
          <span>{crag.rock_type || "unknown rock"}</span>
          {crag.best_window && crag.best_window !== "No clear window" && (
            <>
              <span className="fact-dot">·</span>
              <span>Best: {crag.best_window}</span>
            </>
          )}
        </div>

        {/* Secondary weather data — grouped, muted, small. */}
        <div className="secondary-stats">
          {secondary.map((stat) => (
            <div className="secondary-stat" key={stat.label}>
              <span className="secondary-label">{stat.label}</span>
              <span className="secondary-value">{stat.value}</span>
            </div>
          ))}
        </div>

        <button
          className="details-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Hide details" : "Details"}
        </button>

        {open && (
          <div className="crag-card-details">
            <div className="detail-block">
              <span className="detail-heading">Drying outlook</span>
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Last rain</span>
                  <strong>{crag.last_rain_event || "n/a"}</strong>
                </div>
                <div className="detail-item">
                  <span>Est. dry</span>
                  <strong>{crag.estimated_dry || "n/a"}</strong>
                </div>
                <div className="detail-item">
                  <span>Confidence</span>
                  <strong className={confidenceClass(crag.drying_confidence)}>
                    {crag.drying_confidence || "Low"}
                  </strong>
                </div>
              </div>
            </div>

            {crag.forecast && crag.forecast.length > 0 && (
              <div className="detail-block">
                <span className="detail-heading">5-day outlook</span>
                <ForecastRow forecast={crag.forecast} />
              </div>
            )}

            {crag.signal_reasons && crag.signal_reasons.length > 0 && (
              <div className="detail-block">
                <span className="detail-heading">Why</span>
                <ul className="reason-list">
                  {crag.signal_reasons.slice(0, 4).map((reason, index) => (
                    <li key={`${reason}-${index}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <a
          className="nav-button"
          href={getMapLink(crag.area)}
          target="_blank"
          rel="noreferrer"
        >
          Navigate
        </a>
      </div>
    </article>
  );
}
