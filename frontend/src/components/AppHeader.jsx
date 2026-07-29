import StatusBadge from "./StatusBadge";
import { heroPhoto } from "../lib/conditions";

// Compact top bar. Keeps the hero hand photo (existing branding) but shrinks it
// to a thumbnail so the map/list can own the screen. Shows the current home and
// the headline Go/Maybe/No-Go for the top pick.
export default function AppHeader({ title, home, goStatus, onHomeClick }) {
  return (
    <header className="app-header">
      <img className="app-header-photo" src={heroPhoto} alt="climbing hand on rock" />
      <div className="app-header-text">
        <span className="app-header-title">RockRadar</span>
        <button className="app-header-home" onClick={onHomeClick}>
          {home || "Set home"} ›
        </button>
      </div>
      <div className="app-header-right">
        <span className="app-header-section">{title}</span>
        {goStatus && <StatusBadge goStatus={goStatus} size="sm" />}
      </div>
    </header>
  );
}
