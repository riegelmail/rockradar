// Slim, always-visible filter row for the Map and List tabs: drive time +
// climbing style. Home base lives on the Profile tab.
export default function FilterBar({ maxHours, style, onMaxHours, onStyle }) {
  return (
    <div className="filter-bar">
      <label className="filter-field">
        <span className="filter-label">Drive</span>
        <select value={maxHours} onChange={(e) => onMaxHours(Number(e.target.value))}>
          <option value="1">≤ 1 hr</option>
          <option value="2">≤ 2 hrs</option>
          <option value="3">≤ 3 hrs</option>
          <option value="4">≤ 4 hrs</option>
          <option value="6">≤ 6 hrs</option>
          <option value="8">≤ 8 hrs</option>
          {/* Not truly unlimited — the backend already caps how far it
              searches (SEARCH_RADIUS_MILES), so this just stops filtering
              by drive time on top of that. 24 is the backend's own max. */}
          <option value="24">Any</option>
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
