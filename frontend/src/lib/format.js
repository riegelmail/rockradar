// Presentation helpers: crag photos, status normalization, and small
// formatters shared across screens. No network here — pure functions.

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

function normalizeAreaKey(value) {
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
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    area
  )}`;
}

// ---------------------------------------------------------------------------
// Status model
// ---------------------------------------------------------------------------
// The backend go_status ("Go" / "Maybe" / "No Go") is the single source of
// truth for the traffic-light color. Everything visual keys off this.
export const STATUS = {
  go: { key: "go", label: "Go", color: "#2e9e5b" },
  maybe: { key: "maybe", label: "Maybe", color: "#d9931a" },
  nogo: { key: "nogo", label: "No-Go", color: "#d64545" },
  unranked: { key: "unranked", label: "Unranked", color: "#8a94a6" },
};

export function statusFromGoStatus(goStatus) {
  if (goStatus === "Go") return STATUS.go;
  if (goStatus === "Maybe") return STATUS.maybe;
  if (goStatus === "No Go" || goStatus === "No-Go") return STATUS.nogo;
  return STATUS.unranked;
}

export function formatForecastLabelClass(label) {
  if (label === "Dry") return "go";
  if (label === "Drying") return "maybe";
  return "nogo";
}
