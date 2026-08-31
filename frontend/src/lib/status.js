// =========================================================================
// RockRadar — status helpers
//
// Status colour is the app's only real "brand" colour system: green = go,
// amber = maybe, red = no-go. Everything else in the UI stays neutral so the
// Go/Maybe/No-Go signal reads instantly, the way it does in Mountain Project /
// AllTrails.
// =========================================================================

// Backend emits go_status as "Go" | "Maybe" | "No Go".
export function statusKey(goStatus) {
  if (goStatus === "Go") return "go";
  if (goStatus === "Maybe") return "maybe";
  return "nogo";
}

// Hex values used by the Leaflet map markers (which can't read CSS vars).
export const STATUS_COLORS = {
  go: "#22c55e",
  maybe: "#f59e0b",
  nogo: "#ef4444",
  none: "#6b7280",
};

export function statusColor(goStatus) {
  return STATUS_COLORS[statusKey(goStatus)] || STATUS_COLORS.none;
}

// Short label for compact chips / pins.
export function statusLabel(goStatus) {
  if (goStatus === "Go") return "Go";
  if (goStatus === "Maybe") return "Maybe";
  return "No-Go";
}

export function scoreClass(score) {
  if (score >= 85) return "score-chip score-go";
  if (score >= 65) return "score-chip score-maybe";
  return "score-chip score-nogo";
}

export function confidenceClass(confidence) {
  if (confidence === "High") return "score-go";
  if (confidence === "Medium") return "score-maybe";
  return "score-nogo";
}

export function outlookClass(label) {
  if (label === "Dry") return "outlook-pill outlook-dry";
  if (label === "Drying") return "outlook-pill outlook-drying";
  return "outlook-pill outlook-wet";
}

// The /api/score response carries the winner as flat best_* fields and the
// runners-up as `alternates[]` with a different shape. Normalise both into a
// single ranked-crag record so the map and list can treat them uniformly.
export function toRankedCrags(data) {
  if (!data || data.best_area === "Nothing worth the drive in range.") {
    return [];
  }

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
    drive_time: data.drive_time,
    forecast: data.forecast,
  };

  const alternates = Array.isArray(data.alternates) ? data.alternates : [];
  return [best, ...alternates].map((crag, index) => ({
    ...crag,
    rank: index + 1,
  }));
}
