// =========================================================================
// Shared crag helpers: photos, status model, and data normalization.
// Pure functions only — no React, no side effects — so screens and the map
// can share one source of truth for status colors and crag identity.
// =========================================================================

import exit38Photo from "../assets/crags/exit-38-north-bend.jpg";
import indexHagakurePhoto from "../assets/crags/index-hagakure.jpg";
import indexRiverBouldersPhoto from "../assets/crags/index-river-boulders.jpg";
import leavenworthPhoto from "../assets/crags/leavenworth-icicle-canyon.jpg";
import tietonPhoto from "../assets/crags/tieton-the-bend.jpg";
import vantagePhoto from "../assets/crags/vantage-frenchman-coulee.jpg";

const cragPhotos = {
  "Index – River Boulders": indexRiverBouldersPhoto,
  "Index – Overhung / Hagakure-ish": indexHagakurePhoto,
  "Tieton – The Bend": tietonPhoto,
  "Leavenworth – Icicle Canyon": leavenworthPhoto,
  "Exit 38 – North Bend": exit38Photo,
  "Vantage – Frenchman Coulee": vantagePhoto,
};

const fallbackCragPhoto = tietonPhoto;

// Normalizes crag display names so en-dash / mojibake variants still match.
export function normalizeAreaKey(value) {
  return (value || "")
    .normalize("NFKC")
    .replace(/â€“|â€”/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s/-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function getCragPhoto(area) {
  if (!area) return fallbackCragPhoto;
  const normalizedTarget = normalizeAreaKey(area);
  const match = Object.entries(cragPhotos).find(
    ([key]) => normalizeAreaKey(key) === normalizedTarget
  );
  return match ? match[1] : fallbackCragPhoto;
}

export function getMapLink(area) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(area)}`;
}

// -------------------------------------------------------------------------
// Status model — the only place Go/Maybe/No-Go maps to a color.
// Backend emits "Go" | "Maybe" | "No Go". Anything else (a crag we have
// coordinates for but no score) is treated as "unknown".
// -------------------------------------------------------------------------
export const STATUS = {
  go: { key: "go", label: "Go", color: "#22c55e", tint: "#0f2e1c" },
  maybe: { key: "maybe", label: "Maybe", color: "#f59e0b", tint: "#33270a" },
  nogo: { key: "nogo", label: "No-Go", color: "#ef4444", tint: "#331215" },
  unknown: { key: "unknown", label: "—", color: "#94a3b8", tint: "#1c2230" },
};

export function statusInfo(goStatus) {
  if (goStatus === "Go") return STATUS.go;
  if (goStatus === "Maybe") return STATUS.maybe;
  if (goStatus === "No Go") return STATUS.nogo;
  return STATUS.unknown;
}

// -------------------------------------------------------------------------
// Normalize the /api/score response into one flat, uniformly-shaped list of
// ranked crags. The backend names the winner's field `best_area` but the
// alternates' field `area`; everything downstream wants a single `area` key.
// This does NOT change any values — purely a shape reconciliation.
// -------------------------------------------------------------------------
export function rankedCrags(data) {
  if (!data || !data.best_area) return [];
  if (data.best_area === "Nothing worth the drive in range.") return [];

  const best = {
    area: data.best_area,
    rock_type: data.rock_type,
    overhang: data.overhang,
    conditions_score: data.conditions_score,
    go_status: data.go_status,
    signal_summary: data.signal_summary,
    signal_reasons: data.signal_reasons,
    temperature: data.temperature,
    humidity: data.humidity,
    dew_point: data.dew_point,
    rain: data.rain,
    wind: data.wind,
    last_rain_event: data.last_rain_event,
    estimated_dry: data.estimated_dry,
    drying_confidence: data.drying_confidence,
    best_window: data.best_window,
    forecast: data.forecast,
    drive_time: data.drive_time,
    isTopPick: true,
  };

  const alternates = (data.alternates || []).map((alt) => ({
    ...alt,
    isTopPick: false,
  }));

  return [best, ...alternates];
}
