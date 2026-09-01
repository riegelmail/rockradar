import { useEffect, useState } from "react";
import { REGIONS, heroPhoto, fetchCrags } from "../lib/conditions";

// Landing screen, shown before the user has picked a region. Replaces the
// old "drop straight into a single local map" entry point — RockRadar now
// covers more than one drive-time radius, so the first thing to choose is
// where, not just when/what-style.
export default function RegionScreen({ onSelect }) {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    REGIONS.filter((r) => !r.comingSoon).forEach((r) => {
      fetchCrags(r.id)
        .then((crags) => {
          if (!cancelled) setCounts((prev) => ({ ...prev, [r.id]: crags.length }));
        })
        .catch(() => {
          // Leave it as "Loading…" -> falls back silently; the region's own
          // Map/List tabs will surface a real error if it's actually down.
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="region-screen">
      <div className="region-hero">
        <img src={heroPhoto} alt="" />
        <div className="region-hero-scrim" />
        <div className="region-hero-top">
          <span className="region-hero-brand">RockRadar</span>
        </div>
        <div className="region-hero-bottom">
          <h1>Where's it dry?</h1>
          <p>Pick a region to see live Go / Maybe / No-Go conditions.</p>
        </div>
      </div>

      <div className="region-list">
        <div className="region-section-label">Choose a region</div>

        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`region-card${r.comingSoon ? " disabled" : ""}`}
            onClick={() => !r.comingSoon && onSelect(r.id)}
            disabled={r.comingSoon}
          >
            {r.photo ? (
              <img className="region-card-photo" src={r.photo} alt="" />
            ) : (
              <div className="region-card-photo region-card-photo-placeholder" aria-hidden="true">
                <MountainIcon />
              </div>
            )}

            <div className="region-card-body">
              <div className="region-card-name">{r.name}</div>
              <div className="region-card-subtitle">{r.subtitle}</div>
              {r.comingSoon ? (
                <div className="region-card-soon">Expanding soon — not live yet</div>
              ) : (
                <div className="region-card-count">
                  {counts[r.id] != null ? `${counts[r.id]} crags` : "Loading…"}
                </div>
              )}
            </div>

            {!r.comingSoon && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="region-card-chevron" aria-hidden="true">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function MountainIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 18 9 9l4 5 3-4 5 8H3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
