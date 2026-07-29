import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { statusInfo, normalizeAreaKey } from "../lib/crags";

// Vanilla Leaflet wrapped in a thin React lifecycle. We drive markers
// imperatively rather than pulling in react-leaflet — one dependency instead
// of a peer-dep chain, and no React 19 compatibility surprises.
//
// Status pins use circleMarkers (vector), so there are no marker-image assets
// to 404 and no icon config to get wrong.
export default function MapView({
  crags,
  statusByName,
  home,
  selectedName,
  onSelect,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const homeMarkerRef = useRef(null);
  const onSelectRef = useRef(onSelect);

  // Keep the latest onSelect without re-binding every marker on each render.
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Init once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    // No on-screen zoom control: it would fight the filter/legend overlay.
    // Pinch, scroll-wheel, and keyboard (+/-) zoom all remain available.
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([47.4, -121.3], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    // First paint can happen before layout settles (tab just became visible),
    // leaving grey tiles until a resize — nudge it once on the next frame.
    const t = setTimeout(() => map.invalidateSize(), 0);

    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markersRef.current = new Map();
      homeMarkerRef.current = null;
    };
  }, []);

  // Draw / redraw crag markers when data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = new Map();

    const bounds = [];

    (crags || []).forEach((crag) => {
      if (crag.lat == null || crag.lon == null) return;
      const status = statusByName?.[normalizeAreaKey(crag.name)];
      const info = statusInfo(status);

      const marker = L.circleMarker([crag.lat, crag.lon], {
        radius: 9,
        color: "#0b0d12",
        weight: 2,
        fillColor: info.color,
        fillOpacity: status ? 0.95 : 0.55,
      });

      marker.on("click", () => onSelectRef.current?.(crag.name));
      marker.bindTooltip(crag.name, { direction: "top", offset: [0, -6] });
      marker.addTo(map);
      markersRef.current.set(normalizeAreaKey(crag.name), marker);
      bounds.push([crag.lat, crag.lon]);
    });

    if (home?.lat != null && home?.lon != null) {
      if (homeMarkerRef.current) homeMarkerRef.current.remove();
      homeMarkerRef.current = L.circleMarker([home.lat, home.lon], {
        radius: 6,
        color: "#e8ebf0",
        weight: 3,
        fillColor: "#3c78ff",
        fillOpacity: 1,
      })
        .bindTooltip(`Home: ${home.name || "you"}`, { direction: "top" })
        .addTo(map);
      bounds.push([home.lat, home.lon]);
    }

    if (bounds.length > 0) {
      // Reserve room for the top overlay (filter + legend) and the bottom
      // sheet so pins land in the visible band, not underneath the chrome.
      map.fitBounds(bounds, {
        paddingTopLeft: [28, 150],
        paddingBottomRight: [28, 300],
        maxZoom: 9,
      });
    }
  }, [crags, statusByName, home]);

  // Reflect the externally-selected crag: pop its tooltip + recenter gently.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Highlight the selected marker without recentering — a panTo here would
    // fight fitBounds on load (the default selection is the top pick) and can
    // tuck the pin under the bottom sheet.
    markersRef.current.forEach((marker, key) => {
      const isSel = key === normalizeAreaKey(selectedName || "");
      marker.setStyle({ weight: isSel ? 4 : 2, radius: isSel ? 12 : 9 });
      if (isSel) marker.bringToFront();
    });
  }, [selectedName]);

  return <div ref={containerRef} className="map-canvas" />;
}
