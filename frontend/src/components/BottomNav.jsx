// Fixed bottom navigation, iOS-tab-bar style. Icons are inline SVG so we add
// zero dependencies and no icon-font network request.

const ICONS = {
  map: (
    <path d="M9 3 3.5 5.2A1 1 0 0 0 3 6.1v13a.5.5 0 0 0 .7.46L9 17.5l6 2.5 5.3-2.2a1 1 0 0 0 .7-.93V3.9a.5.5 0 0 0-.7-.46L15 5.5 9 3Zm0 0v14.5M15 5.5V20" />
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  saved: (
    <path d="M6 3h12a1 1 0 0 1 1 1v16l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
};

const TABS = [
  { id: "map", label: "Map" },
  { id: "list", label: "List" },
  { id: "saved", label: "Saved" },
  { id: "profile", label: "Profile" },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`bottom-nav-item ${active === tab.id ? "is-active" : ""}`}
          aria-current={active === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          <svg
            className="bottom-nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[tab.id]}
          </svg>
          <span className="bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
