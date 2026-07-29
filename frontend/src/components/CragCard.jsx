import { getCragPhoto, getMapLink } from "../lib/format";
import StatusBadge from "./StatusBadge";
import ConditionStats from "./ConditionStats";
import ForecastRow from "./ForecastRow";

// The core content unit, used in the list and in the map's detail sheet.
// Reading order is deliberate and matches the redesign goals:
//   1. a real photo of the crag (the lead)
//   2. the Go / Maybe / No-Go status badge (dominant, overlaid on the photo)
//   3. the crag name + one-line summary
//   4. everything numeric, de-emphasized, grouped below
//
// `detailed` controls how much secondary data shows: the feature card (top
// pick / selected pin) shows the full breakdown; compact list rows show less.
export default function CragCard({ item, rank, detailed = false }) {
  const scored = item.scored;
  const goStatus = scored?.go_status;

  return (
    <article className={`crag-card ${detailed ? "crag-card-detailed" : ""}`}>
      <div className="crag-media">
        <img
          className="crag-photo"
          src={getCragPhoto(item.name)}
          alt={item.name}
          loading="lazy"
        />
        <div className="crag-media-overlay" />

        {rank ? <span className="rank-pill">#{rank}</span> : null}
        {typeof scored?.conditions_score === "number" ? (
          <span className="score-pill">{scored.conditions_score}</span>
        ) : null}

        {goStatus ? (
          <StatusBadge
            goStatus={goStatus}
            size={detailed ? "lg" : "md"}
            className="crag-media-badge"
          />
        ) : null}
      </div>

      <div className="crag-body">
        <div className="crag-title-row">
          <h3 className="crag-name">{item.name}</h3>
        </div>

        {scored?.signal_summary ? (
          <p className="crag-summary">{scored.signal_summary}</p>
        ) : null}

        <div className="crag-meta">
          {scored?.rock_type ? <span>{scored.rock_type}</span> : null}
          {typeof scored?.drive_time === "number" ? (
            <span>{scored.drive_time} hr drive</span>
          ) : null}
          {scored?.best_window ? <span>{scored.best_window}</span> : null}
        </div>

        {scored ? (
          <>
            <ConditionStats scored={scored} />

            {scored.forecast?.length ? (
              <div className="crag-section">
                <span className="crag-section-title">5-day outlook</span>
                <ForecastRow forecast={scored.forecast} />
              </div>
            ) : null}

            {detailed && scored.signal_reasons?.length ? (
              <div className="crag-section">
                <span className="crag-section-title">Why</span>
                <ul className="reason-list">
                  {scored.signal_reasons.slice(0, 3).map((reason, i) => (
                    <li key={`${reason}-${i}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <a
              className="nav-button"
              href={getMapLink(item.name)}
              target="_blank"
              rel="noreferrer"
            >
              Navigate
            </a>
          </>
        ) : (
          <p className="crag-unranked-note">
            Outside your drive-time or style filter — widen the filters to
            score this crag.
          </p>
        )}
      </div>
    </article>
  );
}
