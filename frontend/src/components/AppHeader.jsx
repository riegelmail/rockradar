import StatusBadge from "./StatusBadge";
import { heroPhoto, SEARCH_RADIUS_MILES } from "../lib/conditions";

// Compact top bar. Home + search radius are the loudest thing here on
// purpose — with no more named regions, "what area am I looking at" has to
// be answerable at a glance instead of buried in a drive-time dropdown.
export default function AppHeader({ title, home, goStatus, onHomeClick }) {
  return (
    <header className="app-header">
      <img className="app-header-photo" src={heroPhoto} alt="climbing hand on rock" />
      <div className="app-header-text">
        <span className="app-header-brand">RockRadar</span>
        <button className="app-header-home" onClick={onHomeClick}>
          <span className="app-header-home-name">{home || "Set home"}</span>
          <span className="app-header-radius">
            within {SEARCH_RADIUS_MILES} mi ›
          </span>
        </button>
      </div>
      <div className="app-header-right">
        <span className="app-header-section">{title}</span>
        {goStatus && <StatusBadge goStatus={goStatus} size="sm" />}
      </div>
    </header>
  );
}
