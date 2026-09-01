// =========================================================================
// RockRadar — data & conditions layer
//
// This module owns everything that talks to the backend / weather APIs.
// It was lifted verbatim out of the original App.jsx during the frontend
// redesign so the API contract and scoring inputs stay byte-for-byte
// identical — this is a visual/structural rework, not a logic change.
// =========================================================================

import handPhoto from "../assets/crags/hand.jpg";
import exit38Photo from "../assets/crags/exit-38-north-bend.jpg";
import indexHagakurePhoto from "../assets/crags/index-hagakure.jpg";
import indexRiverBouldersPhoto from "../assets/crags/index-river-boulders.jpg";
import leavenworthPhoto from "../assets/crags/leavenworth-icicle-canyon.jpg";
import tietonPhoto from "../assets/crags/tieton-the-bend.jpg";
import vantagePhoto from "../assets/crags/vantage-frenchman-coulee.jpg";
import squamishApronPhoto from "../assets/crags/squamish-grand-wall-apron.jpg";
import squamishSmokeBluffsPhoto from "../assets/crags/squamish-chek-smoke-bluffs.jpg";
import squamishBouldersPhoto from "../assets/crags/squamish-grand-wall-boulders.jpg";

export const API_BASE =
  import.meta.env.VITE_API_BASE || "https://rockradar-backend.onrender.com";
const WEATHER_CACHE_TTL_MS = 25 * 60 * 1000;

export const heroPhoto = handPhoto;

const cragPhotos = {
  "Index – River Boulders": indexRiverBouldersPhoto,
  "Index – Overhung / Hagakure-ish": indexHagakurePhoto,
  "Tieton – The Bend": tietonPhoto,
  "Leavenworth – Icicle Canyon": leavenworthPhoto,
  "Exit 38 – North Bend": exit38Photo,
  "Vantage – Frenchman Coulee": vantagePhoto,
  "Squamish – Grand Wall / Apron": squamishApronPhoto,
  "Squamish – Smoke Bluffs": squamishSmokeBluffsPhoto,
  "Squamish – Grand Wall Boulders": squamishBouldersPhoto,
};

const fallbackCragPhoto = tietonPhoto;

// How far out we search from home — matches the backend's MAX_RADIUS_MILES
// (itself capped by what OpenBeta's public API allows per query). Shown in
// the UI so "what area am I looking at" is never a mystery.
export const SEARCH_RADIUS_MILES = 200;

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
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(area)}`;
}

export function getInitialHome() {
  if (typeof window === "undefined") return "Mirrormont, WA";
  return localStorage.getItem("rockradarHome") || "Mirrormont, WA";
}

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || !parsed?.data) return null;
    if (Date.now() - parsed.timestamp > WEATHER_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch {
    // ignore
  }
}

function cToF(c) {
  return Math.round(((c * 9) / 5 + 32) * 10) / 10;
}

function kmhToMph(kmh) {
  return Math.round(kmh * 0.621371 * 10) / 10;
}

function formatForecastDay(index, isoDate) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
    new Date(`${isoDate}T12:00:00`)
  );
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export async function geocodeHome(homeQuery) {
  const query = homeQuery?.trim() || "Mirrormont, WA";
  const cacheKey = `homeGeocode:${query}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us,ca");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "RockRadar/1.0" },
  });

  if (!res.ok) {
    return { name: query, lat: 47.484, lon: -121.999 };
  }

  const data = await res.json();
  if (!data?.length) {
    return { name: query, lat: 47.484, lon: -121.999 };
  }

  const result = {
    name: query,
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
  };

  setCache(cacheKey, result);
  return result;
}

// Live radius-based lookup — crags near (lat, lon), curated favorites first,
// OpenBeta filling in everywhere else. Cache key is coarse (rounded to
// ~1 mile) so re-geocoding the same home text doesn't miss the cache.
//
// nationwide=true ignores lat/lon entirely and asks the backend for its
// cached nationwide sweep instead (see main.py's get_nationwide_crags) —
// used for the "Drive: Any" view, which shows the whole map at once rather
// than whatever's within range of home.
export async function fetchCrags(lat, lon, nationwide = false) {
  const cacheKey = nationwide
    ? "cragList:nationwide"
    : lat != null && lon != null
      ? `cragList:${lat.toFixed(2)},${lon.toFixed(2)}`
      : "cragList:all";
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = new URL(`${API_BASE}/api/crags`);
  if (nationwide) {
    url.searchParams.set("nationwide", "true");
  } else if (lat != null && lon != null) {
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
  }

  const data = await fetchJson(url.toString());
  setCache(cacheKey, data);
  return data;
}

// Small helper so a parallel batch fails gracefully one-by-one instead of
// the whole batch dying when a single request errors out (e.g. Open-Meteo 429).
function settle(promise) {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error })
  );
}

// How many days of history to pull back so we can measure a real
// "days since last measurable rain" instead of guessing from a 24h window.
const RAIN_HISTORY_DAYS = 7;
const MEASURABLE_RAIN_MM = 1.0;

// Open-Meteo's hourly/daily arrays span [past_days .. forecast_days] with
// "now" sitting in the middle, not at the end — so slicing from the end of
// the array grabs the tail of the forecast, not the trailing 24h/today.
function computeRain24h(hourlyTimes, hourlyPrecip, nowTime) {
  const nowIndex = hourlyTimes.indexOf(nowTime);
  const window =
    nowIndex >= 0
      ? hourlyPrecip.slice(Math.max(0, nowIndex - 23), nowIndex + 1)
      : hourlyPrecip.slice(-24);
  return window.reduce((sum, n) => sum + Number(n || 0), 0);
}

function computeDaysSinceRain(dailyPrecip, todayIndex) {
  if (todayIndex == null || todayIndex < 0) {
    return { days: null, capped: false };
  }
  for (let i = todayIndex - 1; i >= 0; i--) {
    if (Number(dailyPrecip[i] || 0) >= MEASURABLE_RAIN_MM) {
      return { days: todayIndex - i, capped: false };
    }
  }
  // No measurable rain anywhere in the requested history window — report
  // the window size as a (conservative) lower bound rather than guessing.
  return { days: todayIndex, capped: true };
}

function normalizeWeatherData(crag, data) {
  const current = data.current || {};
  const hourlyTimes = data.hourly?.time || [];
  const hourlyPrecip = data.hourly?.precipitation || [];
  const rain24h = computeRain24h(hourlyTimes, hourlyPrecip, current.time);

  const dailyTimes = data.daily?.time || [];
  const dailyPrecip = data.daily?.precipitation_sum || [];
  const todayDateStr = (current.time || "").slice(0, 10);
  let todayIndex = dailyTimes.indexOf(todayDateStr);
  if (todayIndex < 0) todayIndex = Math.max(0, dailyTimes.length - 5);
  const daysSinceRain = computeDaysSinceRain(dailyPrecip, todayIndex);

  return {
    name: crag.name,
    current: {
      temperature_f: cToF(Number(current.temperature_2m || 0)),
      humidity: Number(current.relative_humidity_2m || 0),
      dew_point_f: cToF(Number(current.dew_point_2m || 0)),
      wind_mph: kmhToMph(Number(current.wind_speed_10m || 0)),
      rain_now: Number(current.precipitation || 0),
      rain_24h: Math.round(rain24h * 100) / 100,
      days_since_rain: daysSinceRain.days,
      days_since_rain_capped: daysSinceRain.capped,
    },
    // Only today-forward — past_days shifts dailyTimes[0] into history, so
    // slicing from todayIndex keeps "Today"/"Tomorrow" labels accurate.
    forecast: dailyTimes.slice(todayIndex).map((isoDate, index) => {
      const i = todayIndex + index;
      return {
        day: formatForecastDay(index, isoDate),
        high_f: cToF(Number(data.daily.temperature_2m_max?.[i] || 0)),
        low_f: cToF(Number(data.daily.temperature_2m_min?.[i] || 0)),
        precip: Number(data.daily.precipitation_sum?.[i] || 0),
        humidity: Number(current.relative_humidity_2m || 60),
        dew_point_f: cToF(Number(current.dew_point_2m || 0)),
        wind_mph: kmhToMph(Number(current.wind_speed_10m || 0)),
      };
    }),
  };
}

function buildWeatherUrl(crags) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  // Open-Meteo accepts comma-separated lat/lon lists in one request and
  // returns an array of results in the same order — one round trip for a
  // whole batch of crags instead of one per crag. With a single crag it
  // returns a bare object instead of a 1-item array (handled by the caller).
  url.searchParams.set("latitude", crags.map((c) => c.lat).join(","));
  url.searchParams.set("longitude", crags.map((c) => c.lon).join(","));
  url.searchParams.set(
    "current",
    "temperature_2m,wind_speed_10m,precipitation,relative_humidity_2m,dew_point_2m"
  );
  url.searchParams.set("hourly", "precipitation");
  url.searchParams.set("past_days", String(RAIN_HISTORY_DAYS));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("forecast_days", "5");
  url.searchParams.set("timezone", "auto");
  return url;
}

// Kept comfortably under both Open-Meteo's per-request location limits and
// browser URL-length limits (each lat/lon pair adds ~20 chars to the URL).
const WEATHER_BATCH_SIZE = 40;

async function fetchWeatherBatch(crags) {
  if (crags.length === 0) return [];
  const url = buildWeatherUrl(crags);
  const raw = await fetchJson(url.toString());
  const perLocation = Array.isArray(raw) ? raw : [raw];
  return crags.map((crag, i) => {
    const normalized = normalizeWeatherData(crag, perLocation[i] || {});
    setCache(`cragWeather:${crag.name}`, normalized);
    return normalized;
  });
}

// Fetches weather for every crag, using the cache where possible and one
// batched Open-Meteo request per chunk of uncached crags otherwise — a
// nationwide-sized list (100+ crags) used to mean 100+ individual requests
// (slow, and easy to trip Open-Meteo's rate limiting); this cuts that down
// to a handful. If a whole chunk's batched request fails, that chunk falls
// back to fetching its crags one at a time so a single bad request doesn't
// wipe out everything else that would otherwise have succeeded.
async function fetchAllCragWeather(crags) {
  const results = [];
  const toFetch = [];
  for (const crag of crags) {
    const cached = getCache(`cragWeather:${crag.name}`);
    if (cached) {
      results.push({ ok: true, value: cached });
    } else {
      toFetch.push(crag);
    }
  }

  const chunks = [];
  for (let i = 0; i < toFetch.length; i += WEATHER_BATCH_SIZE) {
    chunks.push(toFetch.slice(i, i + WEATHER_BATCH_SIZE));
  }

  const chunkOutcomes = await Promise.all(chunks.map((chunk) => settle(fetchWeatherBatch(chunk))));
  for (let i = 0; i < chunkOutcomes.length; i++) {
    const outcome = chunkOutcomes[i];
    if (outcome.ok) {
      outcome.value.forEach((value) => results.push({ ok: true, value }));
      continue;
    }
    // The batch itself failed (e.g. one malformed coordinate, or a 429) —
    // retry this chunk's crags individually rather than losing all of them.
    const individual = await Promise.all(
      chunks[i].map((crag) => settle(fetchWeatherBatch([crag]).then((r) => r[0])))
    );
    results.push(...individual);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Orchestration: fetch crags + geocode home + per-crag weather, then POST to
// the scoring endpoint. Returns { data, crags } so views can join scored
// results back to crag coordinates for the map. Behaviour is unchanged from
// the original App.jsx loadData().
// ---------------------------------------------------------------------------
export async function loadConditions({ homeBase, maxHours, style }) {
  // "Any" is the nationwide view — see fetchCrags/get_nationwide_crags.
  // Every other value is the normal home-radius search.
  const nationwide = maxHours === "any";

  // Home has to be geocoded before we know what to search near — crags are
  // no longer a fixed named-region list, they're whatever's live within
  // range of this specific home. (Still geocoded in nationwide mode too —
  // drive time per crag is shown relative to home even when it's not used
  // to filter anything out.)
  const cacheKey = `scoreResult:${homeBase}:${maxHours}:${style}`;
  const home = await geocodeHome(homeBase);
  const crags = await fetchCrags(home.lat, home.lon, nationwide);

  // Fetch weather for every crag in a handful of batched requests rather
  // than one request per crag — see fetchAllCragWeather. Don't let one
  // failure (e.g. a 429 from Open-Meteo) wipe out the whole result either.
  const settled = await fetchAllCragWeather(crags);
  const weather = settled
    .filter((result) => result.ok && result.value)
    .map((result) => result.value);

  if (weather.length === 0) {
    throw new Error("All weather requests failed");
  }

  const scored = await fetchJson(`${API_BASE}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      home,
      // The backend still requires a real number here even in nationwide
      // mode (it just ignores it for filtering) — 24 is its own max.
      max_hours: nationwide ? 24 : maxHours,
      style,
      weather,
      nationwide,
    }),
  });

  setCache(cacheKey, scored);
  return { data: scored, crags, home };
}

export function getScoreCache({ homeBase, maxHours, style }) {
  return getCache(`scoreResult:${homeBase}:${maxHours}:${style}`);
}
