import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import CragCard from "../components/CragCard";
import StatusBadge from "../components/StatusBadge";
import { STATUS } from "../lib/format";

// Map-first home screen. Crags are traffic-light pins on an OpenStreetMap
// base layer (free, no API key). Tapping a pin opens a detail sheet with the
// full CragCard for that crag.
//
// Leaflet is driven imperatively through refs — it owns its own DOM subtree,
// so we let React render the container and the sheet, and reconcile markers
// by hand when the scored data changes.

// A circular status pin, colored by the traffic-light status. Anchored at
// its center so it sits on the crag coordinates.
function pinIcon(status, selected) {
  const size = selected ? 30 : 24;
  const anchor = size / 2;
  return L.divIcon({
    className: "",
    html: `<span class="map-pin ${selected ? "map-pin-selected" : ""}"
                 style="--pin-color:${status.color}"></span>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    popupAnchor: [0, -anchor],
  });
}

const homeIcon = L.divIcon({
  className: "",
  html: `<span class="map-home-pin" title="Home"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MapScreen({
  mappedCrags,
  homeGeo,
  selectedName,
  onSelect,
  loading,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const homeMarkerRef = useRef(null);
  const didFitRef = useRef(false);

  const selected = useMemo(
    () => mappedCrags.find((c) => c.name === selectedName) || null,
    [mappedCrags, selectedName]
  );

  // Create the map once.
  useEffect(() => {
    if (mapRef.current || !mapNodeRef.current) return;

    const map = L.map(mapNodeRef.current, {
      center: [47.4, -121.4],
      zoom: 7,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Tapping empty map closes the detail sheet.
    map.on("click", () => onSelect(null));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = new Map();
      homeMarkerRef.current = null;
      didFitRef.current = false;
    };
    // onSelect is stable enough for this lifecycle; we intentionally create once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile crag markers whenever the scored/status data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set();

    mappedCrags.forEach((crag) => {
      if (typeof crag.lat !== "number" || typeof crag.lon !== "number") return;
      seen.add(crag.name);

      const isSelected = crag.name === selectedName;
      let marker = markersRef.current.get(crag.name);

      if (!marker) {
        marker = L.marker([crag.lat, crag.lon], {
          icon: pinIcon(crag.status, isSelected),
          title: crag.name,
          riseOnHover: true,
        });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelect(crag.name);
        });
        marker.addTo(map);
        markersRef.current.set(crag.name, marker);
      } else {
        marker.setIcon(pinIcon(crag.status, isSelected));
        marker.setLatLng([crag.lat, crag.lon]);
      }
    });

    // Drop markers for crags that disappeared (shouldn't happen, but tidy).
    markersRef.current.forEach((marker, name) => {
      if (!seen.has(name)) {
        map.removeLayer(marker);
        markersRef.current.delete(name);
      }
    });
  }, [mappedCrags, selectedName, onSelect]);

  // Home marker + one-time fit-to-bounds once we have coordinates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const points = mappedCrags
      .filter((c) => typeof c.lat === "number" && typeof c.lon === "number")
      .map((c) => [c.lat, c.lon]);

    if (homeGeo?.lat != null && homeGeo?.lon != null) {
      const homeLatLng = [homeGeo.lat, homeGeo.lon];
      if (!homeMarkerRef.current) {
        homeMarkerRef.current = L.marker(homeLatLng, {
          icon: homeIcon,
          title: `Home: ${homeGeo.name}`,
          interactive: false,
          keyboard: false,
        }).addTo(map);
      } else {
        homeMarkerRef.current.setLatLng(homeLatLng);
      }
      points.push(homeLatLng);
    }

    if (!didFitRef.current && points.length > 0) {
      map.fitBounds(points, { padding: [48, 48], maxZoom: 10 });
      didFitRef.current = true;
    }
  }, [mappedCrags, homeGeo]);

  // Leaflet measures the container on creation; if it mounted while the tab
  // was transitioning, nudge it to remeasure on the next frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="map-screen">
      <div ref={mapNodeRef} className="map-canvas" />

      {loading ? <div className="map-loading-chip">Updating conditions…</div> : null}

      <MapLegend />

      {selected ? (
        <div className="map-sheet" role="dialog" aria-label={selected.name}>
          <button
            type="button"
            className="map-sheet-close"
            onClick={() => onSelect(null)}
            aria-label="Close"
          >
            ×
          </button>
          <div className="map-sheet-scroll">
            <CragCard
              item={selected}
              rank={selected.scored?.rank}
              detailed
            />
          </div>
        </div>
      ) : (
        <SelectHint />
      )}
    </div>
  );
}

function MapLegend() {
  const entries = [STATUS.go, STATUS.maybe, STATUS.nogo, STATUS.unranked];
  return (
    <div className="map-legend" aria-hidden="true">
      {entries.map((s) => (
        <span className="legend-item" key={s.key}>
          <span className="legend-dot" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function SelectHint() {
  return (
    <div className="map-hint">
      <StatusBadge goStatus="Go" size="sm" />
      <span>Tap a pin for conditions</span>
    </div>
  );
}
