// Bottom tab bar — the primary navigation. Map is the default/home tab.
const TABS = [
  { id: "map", label: "Map", icon: MapIcon },
  { id: "list", label: "List", icon: ListIcon },
  { id: "saved", label: "Saved", icon: StarIcon },
  { id: "profile", label: "Profile", icon: UserIcon },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-tab ${isActive ? "active" : ""}`}
            onClick={() => onChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 4v14M15 6v14" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="3.5" cy="6" r="1.3" fill="currentColor" />
      <circle cx="3.5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="3.5" cy="18" r="1.3" fill="currentColor" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m12 3 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9L6.7 19.5l1.1-6L3.4 9.3l6-.8L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
