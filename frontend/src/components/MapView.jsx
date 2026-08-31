import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import StatusBadge from "./StatusBadge";
import { getCragPhoto, getMapLink } from "../lib/conditions";
import { statusColor, scoreClass, toRankedCrags } from "../lib/status";

// Build the colored teardrop pin as an inline SVG divIcon so it can carry the
// status colour (Leaflet's default raster markers can't be recoloured, and
// they also break under bundlers — a divIcon sidesteps both).
function pinIcon(color, selected) {
  const scale = selected ? 1.25 : 1;
  const w = 30 * scale;
  const h = 40 * scale;
  return L.divIcon({
    className: "crag-pin",
    html: `
      <svg width="${w}" height="${h}" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z"
          fill="${color}" stroke="#0b0d12" stroke-width="2"/>
        <circle cx="15" cy="15" r="6" fill="#0b0d12" fill-opacity="0.55"/>
      </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  });
}

function homeIcon() {
  return L.divIcon({
    className: "home-pin",
    html: `<div class="home-pin-dot"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// CARTO dark basemap — OpenStreetMap data, free, no API key — chosen over the
// stock light OSM raster so the map reads as part of the dark app chrome.
const TILE_URL =
  "https://{s}.basemap.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function MapView({ data, crags, home, loading, active = true }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);
  const [selected, setSelected] = useState(null);

  // Join scored status onto every crag coordinate. Crags the backend dropped
  // (out of range / filtered / actively wet) still get a muted pin so the map
  // isn't misleadingly empty — they just carry no status.
  const rankedByName = useMemo(() => {
    const map = new Map();
    toRankedCrags(data).forEach((c) => map.set(c.area, c));
    return map;
  }, [data]);

  const pins = useMemo(() => {
    return (crags || []).map((crag) => ({
      ...crag,
      ranked: rankedByName.get(crag.name) || null,
    }));
  }, [crags, rankedByName]);

  // Init the map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([47.3, -121.2], 7);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Leaflet mis-measures its container when it mounts inside a flex/tab
    // layout that was display:none a tick earlier — force a resize.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Redraw markers whenever the joined data changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const latlngs = [];

    if (home && Number.isFinite(home.lat) && Number.isFinite(home.lon)) {
      L.marker([home.lat, home.lon], { icon: homeIcon(), zIndexOffset: -100 })
        .bindTooltip("Home", { direction: "top" })
        .addTo(layer);
      latlngs.push([home.lat, home.lon]);
    }

    pins.forEach((pin) => {
      if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lon)) return;
      const color = pin.ranked
        ? statusColor(pin.ranked.go_status)
        : statusColor(null);
      const isSelected = selected === pin.name;
      const marker = L.marker([pin.lat, pin.lon], {
        icon: pinIcon(color, isSelected),
        zIndexOffset: isSelected ? 1000 : pin.ranked ? 200 : 0,
      }).addTo(layer);
      marker.on("click", () => setSelected(pin.name));
      latlngs.push([pin.lat, pin.lon]);
    });

    // Fit to all pins on the first successful draw only, so panning/zooming
    // isn't reset every refresh.
    if (!fittedRef.current && latlngs.length > 0) {
      map.fitBounds(latlngs, { padding: [50, 50], maxZoom: 9 });
      fittedRef.current = true;
    }
  }, [pins, home, selected]);

  // Re-measure when this tab becomes visible again — Leaflet can't size a
  // container that was display:none while another tab was active.
  useEffect(() => {
    if (active && mapRef.current) {
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 0);
    }
  }, [active]);

  const selectedPin = pins.find((p) => p.name === selected) || null;
  const selectedRanked = selectedPin?.ranked || null;

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-canvas" />

      {loading && !data && (
        <div className="map-loading">Loading conditions…</div>
      )}

      <div className="map-legend">
        <span><i className="dot dot-go" /> Go</span>
        <span><i className="dot dot-maybe" /> Maybe</span>
        <span><i className="dot dot-nogo" /> No-Go</span>
      </div>

      {selectedPin && (
        <div className="map-sheet" role="dialog">
          <button
            className="map-sheet-close"
            onClick={() => setSelected(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="map-sheet-inner">
            <img
              className="map-sheet-photo"
              src={getCragPhoto(selectedPin.name)}
              alt={selectedPin.name}
            />
            <div className="map-sheet-text">
              <div className="map-sheet-top">
                {selectedRanked ? (
                  <StatusBadge goStatus={selectedRanked.go_status} size="md" />
                ) : (
                  <span className="status-badge status-none status-md">
                    Not in range
                  </span>
                )}
                {selectedRanked && (
                  <span className={scoreClass(selectedRanked.conditions_score)}>
                    {selectedRanked.conditions_score}
                  </span>
                )}
              </div>
              <h3 className="map-sheet-name">{selectedPin.name}</h3>
              {selectedRanked ? (
                <p className="map-sheet-meta">
                  {selectedRanked.drive_time} hr drive · {selectedRanked.temperature}°F ·{" "}
                  {selectedRanked.humidity}% hum
                </p>
              ) : (
                <p className="map-sheet-meta muted">
                  Outside your drive time or filtered by style. Widen the
                  filters to see conditions.
                </p>
              )}
            </div>
          </div>
          <a
            className="nav-button"
            href={getMapLink(selectedPin.name)}
            target="_blank"
            rel="noreferrer"
          >
            Navigate
          </a>
        </div>
      )}
    </div>
  );
}
