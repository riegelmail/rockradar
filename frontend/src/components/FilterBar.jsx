// Slim, always-visible filter row for the Map and List tabs: drive time +
// climbing style. Home base lives on the Profile tab.
//
// "Any" is a distinct mode, not just a big number of hours — it switches
// the whole app over to the nationwide crag map (see conditions.js /
// loadConditions), so picking it has to carry a sentinel ("any") that App.jsx
// can tell apart from a real hour count. Picking any specific hour count
// afterwards switches back to the normal home-radius search — that's the
// "narrow it down after" step.
export default function FilterBar({ maxHours, style, onMaxHours, onStyle }) {
  return (
    <div className="filter-bar">
      <label className="filter-field">
        <span className="filter-label">Drive</span>
        <select
          value={maxHours}
          onChange={(e) => {
            const value = e.target.value;
            onMaxHours(value === "any" ? "any" : Number(value));
          }}
        >
          <option value="1">≤ 1 hr</option>
          <option value="2">≤ 2 hrs</option>
          <option value="3">≤ 3 hrs</option>
          <option value="4">≤ 4 hrs</option>
          <option value="6">≤ 6 hrs</option>
          <option value="8">≤ 8 hrs</option>
          <option value="any">Any (see everything)</option>
        </select>
      </label>

      <label className="filter-field">
        <span className="filter-label">Style</span>
        <select value={style} onChange={(e) => onStyle(e.target.value)}>
          <option value="all">All styles</option>
          <option value="sport">Sport</option>
          <option value="trad">Trad</option>
          <option value="bouldering">Bouldering</option>
        </select>
      </label>
    </div>
  );
}
