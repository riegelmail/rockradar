// Data layer for RockRadar.
//
// This module owns everything that talks to the network: the RockRadar
// backend (/api/crags, /api/score), Open-Meteo (per-crag weather), and
// Nominatim (home-base geocoding). The backend API contract is treated as a
// fixed, stable interface — none of this changes the request/response shapes,
// it only reorganizes the existing logic out of App.jsx so the UI layer can
// stay focused on presentation.

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://rockradar-backend.onrender.com";
const WEATHER_CACHE_TTL_MS = 25 * 60 * 1000;

const DEFAULT_HOME = { name: "Mirrormont, WA", lat: 47.484, lon: -121.999 };

// ---------------------------------------------------------------------------
// localStorage cache with TTL
// ---------------------------------------------------------------------------
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
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // ignore (private mode / quota)
  }
}

// ---------------------------------------------------------------------------
// Unit helpers
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Home-base geocoding (Nominatim)
// ---------------------------------------------------------------------------
export async function geocodeHome(homeQuery) {
  const query = homeQuery?.trim() || DEFAULT_HOME.name;
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

  if (!res.ok) return { ...DEFAULT_HOME, name: query };

  const data = await res.json();
  if (!data?.length) return { ...DEFAULT_HOME, name: query };

  const result = {
    name: query,
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
  };
  setCache(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------------------
// Crag list (backend)
// ---------------------------------------------------------------------------
export async function fetchCrags() {
  const cacheKey = "cragList";
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(`${API_BASE}/api/crags`);
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

// ---------------------------------------------------------------------------
// Per-crag weather (Open-Meteo)
// ---------------------------------------------------------------------------
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

export async function fetchCragWeather(crag) {
  const cacheKey = `cragWeather:${crag.name}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", crag.lat);
  url.searchParams.set("longitude", crag.lon);
  url.searchParams.set(
    "current",
    "temperature_2m,wind_speed_10m,precipitation,relative_humidity_2m,dew_point_2m"
  );
  url.searchParams.set("hourly", "precipitation");
  url.searchParams.set("past_days", String(RAIN_HISTORY_DAYS));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum"
  );
  url.searchParams.set("forecast_days", "5");
  url.searchParams.set("timezone", "auto");

  const data = await fetchJson(url.toString());

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

  const normalized = {
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

  setCache(cacheKey, normalized);
  return normalized;
}

// ---------------------------------------------------------------------------
// Orchestration: crags + weather + scoring
// ---------------------------------------------------------------------------
// Returns { crags, home, scored } where:
//   crags  = raw [{name, lat, lon}] from the backend (used to place map pins)
//   home   = geocoded home base
//   scored = the /api/score response (best pick + alternates)
// The score payload only ranks crags in range/style, so the map layer joins
// `scored` back onto `crags` by name to color-code pins.
export async function loadConditions({ home: homeQuery, maxHours, style }) {
  const [crags, home] = await Promise.all([
    fetchCrags(),
    geocodeHome(homeQuery),
  ]);

  // Fetch weather for each crag, but don't let one failure (e.g. 429 from
  // Open-Meteo) wipe out the whole batch. Keep whatever succeeds.
  const settled = await Promise.all(
    crags.map((crag) => settle(fetchCragWeather(crag)))
  );
  const weather = settled
    .filter((result) => result.ok && result.value)
    .map((result) => result.value);

  if (weather.length === 0) {
    throw new Error("All weather requests failed");
  }

  const scored = await fetchJson(`${API_BASE}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ home, max_hours: maxHours, style, weather }),
  });

  return { crags, home, scored };
}

export { getCache, setCache, DEFAULT_HOME };
