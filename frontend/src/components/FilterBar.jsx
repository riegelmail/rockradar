// Slim filter row shown above the map and list. Drive time and style are the
// two filters that change what the backend scores, so they stay one tap away
// on the primary screens. Home base lives in the Profile tab.

const HOURS = [1, 2, 3, 4, 6, 8];
const STYLES = [
  { value: "all", label: "All" },
  { value: "sport", label: "Sport" },
  { value: "trad", label: "Trad" },
  { value: "bouldering", label: "Boulder" },
];

export default function FilterBar({ maxHours, style, onChange }) {
  return (
    <div className="filter-bar">
      <label className="filter-field">
        <span className="filter-label">Within</span>
        <select
          value={maxHours}
          onChange={(e) => onChange({ maxHours: Number(e.target.value) })}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h} hr
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span className="filter-label">Style</span>
        <select value={style} onChange={(e) => onChange({ style: e.target.value })}>
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
