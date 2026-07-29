import { useState } from "react";

const STYLE_LABELS = {
  all: "All styles",
  sport: "Sport",
  trad: "Trad",
  bouldering: "Bouldering",
};

// A slim summary chip that expands into the full filter controls — the
// standard outdoor-app pattern (AllTrails/OpenSnow) so filters don't eat the
// map. Wiring is unchanged from before: editing home applies on "Update";
// hours/style apply immediately.
export default function FilterBar({
  homeInput,
  setHomeInput,
  onApplyHome,
  homeLabel,
  maxHours,
  setMaxHours,
  style,
  setStyle,
}) {
  const [open, setOpen] = useState(false);

  function applyAndClose() {
    onApplyHome();
    setOpen(false);
  }

  return (
    <div className={`filter-bar ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="filter-summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="filter-summary-main">
          <svg viewBox="0 0 24 24" className="filter-pin" aria-hidden="true">
            <path
              d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle cx="12" cy="10" r="2.4" fill="currentColor" />
          </svg>
          {homeLabel || "Set home base"}
        </span>
        <span className="filter-summary-sub">
          ≤{maxHours}h · {STYLE_LABELS[style] || style}
        </span>
      </button>

      {open && (
        <div className="filter-panel">
          <label className="filter-field filter-field-wide">
            <span>Home base</span>
            <div className="filter-home-row">
              <input
                type="text"
                value={homeInput}
                onChange={(e) => setHomeInput(e.target.value)}
                placeholder="98101 or Seattle, WA"
              />
              <button type="button" onClick={applyAndClose}>
                Update
              </button>
            </div>
          </label>

          <div className="filter-field-row">
            <label className="filter-field">
              <span>Max drive</span>
              <select
                value={maxHours}
                onChange={(e) => setMaxHours(Number(e.target.value))}
              >
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="3">3 hours</option>
                <option value="4">4 hours</option>
                <option value="6">6 hours</option>
                <option value="8">8 hours</option>
              </select>
            </label>

            <label className="filter-field">
              <span>Style</span>
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="all">All</option>
                <option value="sport">Sport</option>
                <option value="trad">Trad</option>
                <option value="bouldering">Bouldering</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
