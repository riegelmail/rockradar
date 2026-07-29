// Fixed bottom navigation, the primary way to move between screens — the
// pattern every outdoor app (AllTrails, OpenSnow, Mountain Project) uses on
// mobile. Icons are inline SVG so there's no icon-font/library dependency.

const ICONS = {
  map: (
    <path
      d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Zm0 0v16m6-14v16"
      fill="none"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  list: (
    <>
      <path
        d="M8 6h13M8 12h13M8 18h13"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="3.5" cy="6" r="1.3" />
      <circle cx="3.5" cy="12" r="1.3" />
      <circle cx="3.5" cy="18" r="1.3" />
    </>
  ),
  saved: (
    <path
      d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"
      fill="none"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" fill="none" strokeWidth="1.8" />
      <path
        d="M4 21c0-4 4-6 8-6s8 2 8 6"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
};

const TABS = [
  { key: "map", label: "Map" },
  { key: "list", label: "List" },
  { key: "saved", label: "Saved" },
  { key: "profile", label: "Profile" },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            className={`nav-tab ${isActive ? "nav-tab-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onChange(tab.key)}
          >
            <svg
              className="nav-icon"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {ICONS[tab.key]}
            </svg>
            <span className="nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
