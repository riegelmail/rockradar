import { useMemo, useState } from "react";
import MapView from "../components/MapView";
import CragCard from "../components/CragCard";
import FilterBar from "../components/FilterBar";
import { STATUS, normalizeAreaKey } from "../lib/crags";

function Legend() {
  const items = [STATUS.go, STATUS.maybe, STATUS.nogo, STATUS.unknown];
  return (
    <div className="map-legend" aria-hidden="true">
      {items.map((s) => (
        <span key={s.key} className="map-legend-item">
          <span className="map-legend-dot" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// Map-first home screen. Pins for every crag we have coordinates for, colored
// by status; tapping one raises a photo-led card in the bottom sheet.
export default function MapScreen({
  crags,
  ranked,
  home,
  loading,
  error,
  filterProps,
}) {
  const statusByName = useMemo(() => {
    const out = {};
    ranked.forEach((c) => {
      out[normalizeAreaKey(c.area)] = c.go_status;
    });
    return out;
  }, [ranked]);

  const rankedByName = useMemo(() => {
    const out = {};
    ranked.forEach((c) => {
      out[normalizeAreaKey(c.area)] = c;
    });
    return out;
  }, [ranked]);

  // The user's explicit pick (may be null). We *derive* the effective
  // selection each render rather than syncing it via an effect: keep the
  // user's tap if that crag is still ranked, otherwise fall back to the top
  // pick. This avoids a setState-in-effect cascade.
  const [picked, setPicked] = useState(null);

  const selectedCrag =
    (picked && rankedByName[normalizeAreaKey(picked)]) || ranked[0] || null;
  const selectedName = selectedCrag?.area || null;
  const selectedRank = selectedCrag
    ? ranked.findIndex((c) => c.area === selectedCrag.area) + 1
    : null;

  return (
    <div className="map-screen">
      <div className="map-overlay-top">
        <FilterBar {...filterProps} />
        <Legend />
      </div>

      <MapView
        crags={crags}
        statusByName={statusByName}
        home={home}
        selectedName={selectedName}
        onSelect={setPicked}
      />

      <div className="map-sheet">
        {error ? (
          <div className="sheet-message error">{error}</div>
        ) : loading && !ranked.length ? (
          <div className="sheet-message">Loading conditions…</div>
        ) : !ranked.length ? (
          <div className="sheet-message">
            Nothing worth the drive in range. Widen the drive time or change the
            style.
          </div>
        ) : selectedCrag ? (
          <CragCard crag={selectedCrag} rank={selectedRank} compact />
        ) : (
          <div className="sheet-message">Tap a pin to see conditions.</div>
        )}
      </div>
    </div>
  );
}
