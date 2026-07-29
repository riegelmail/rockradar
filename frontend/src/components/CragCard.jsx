import StatusBadge from "./StatusBadge";
import { getCragPhoto, getMapLink } from "../lib/crags";

// One metric chip. Deliberately small + muted — secondary data should never
// compete with the photo or the status badge.
function Metric({ label, value }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

// The core content unit. `compact` trims it down for the map's selected-crag
// sheet; the full form is used in the List tab.
export default function CragCard({ crag, rank, compact = false }) {
  if (!crag) return null;

  return (
    <article className={`crag-card ${compact ? "crag-card-compact" : ""}`}>
      <div className="crag-card-photo">
        <img
          src={getCragPhoto(crag.area)}
          alt={crag.area}
          loading="lazy"
        />
        <div className="crag-card-photo-scrim" />
        <div className="crag-card-photo-top">
          {crag.isTopPick ? (
            <span className="top-pick-tag">Top pick</span>
          ) : rank ? (
            <span className="rank-tag">#{rank}</span>
          ) : (
            <span />
          )}
          <StatusBadge status={crag.go_status} size={compact ? "md" : "lg"} />
        </div>
        <h3 className="crag-card-name">{crag.area}</h3>
      </div>

      <div className="crag-card-body">
        <div className="crag-card-meta">
          <span>{crag.rock_type || "unknown rock"}</span>
          {crag.drive_time != null && <span>· {crag.drive_time} hr drive</span>}
          {crag.conditions_score != null && (
            <span className="crag-card-score">· Score {crag.conditions_score}</span>
          )}
        </div>

        {crag.signal_summary && (
          <p className="crag-card-summary">{crag.signal_summary}</p>
        )}

        {/* Secondary data: grouped, muted, small — intentionally quiet. */}
        <div className="metric-row">
          <Metric label="Temp" value={`${crag.temperature}°F`} />
          <Metric label="Humidity" value={`${crag.humidity}%`} />
          <Metric label="Wind" value={crag.wind} />
          {!compact && <Metric label="Dew pt" value={`${crag.dew_point}°F`} />}
          {!compact && <Metric label="Rain" value={crag.rain} />}
        </div>

        <div className="crag-card-drying">
          <span>Dry by <strong>{crag.estimated_dry || "n/a"}</strong></span>
          <span>Last rain <strong>{crag.last_rain_event || "n/a"}</strong></span>
        </div>

        {!compact && crag.signal_reasons?.length > 0 && (
          <ul className="crag-card-reasons">
            {crag.signal_reasons.slice(0, 3).map((reason, i) => (
              <li key={`${reason}-${i}`}>{reason}</li>
            ))}
          </ul>
        )}

        <a
          className="crag-nav-button"
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
