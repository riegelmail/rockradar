import { useEffect, useMemo, useState } from "react";
import "./App.css";

import handPhoto from "./assets/crags/hand.jpg";
import exit38Photo from "./assets/crags/exit-38-north-bend.jpg";
import indexHagakurePhoto from "./assets/crags/index-hagakure.jpg";
import indexRiverBouldersPhoto from "./assets/crags/index-river-boulders.jpg";
import leavenworthPhoto from "./assets/crags/leavenworth-icicle-canyon.jpg";
import tietonPhoto from "./assets/crags/tieton-the-bend.jpg";
import vantagePhoto from "./assets/crags/vantage-frenchman-coulee.jpg";

const API_BASE = import.meta.env.VITE_API_BASE || "https://rockradar-backend.onrender.com";
const WEATHER_CACHE_TTL_MS = 25 * 60 * 1000;
const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSe0vPydbp7trY2-2SLmEkKt20pmFosd7CUlosIi3tYv0VL0PA/viewform?usp=header";

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

function getCragPhoto(area) {
  if (!area) return fallbackCragPhoto;

  const normalizedTarget = normalizeAreaKey(area);
  const match = Object.entries(cragPhotos).find(
    ([key]) => normalizeAreaKey(key) === normalizedTarget
  );

  return match ? match[1] : fallbackCragPhoto;
}

function getMapLink(area) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(area)}`;
}

function getInitialHome() {
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

function scoreClass(score) {
  if (score >= 85) return "score-pill score-green";
  if (score >= 65) return "score-pill score-yellow";
  return "score-pill score-red";
}

function confidenceClass(confidence) {
  if (confidence === "High") return "score-pill score-green";
  if (confidence === "Medium") return "score-pill score-yellow";
  return "score-pill score-red";
}

function goStatusClass(status) {
  if (status === "Go") return "score-pill score-green";
  if (status === "Maybe") return "score-pill score-yellow";
  return "score-pill score-red";
}

function outlookClass(label) {
  if (label === "Dry") return "score-pill score-green";
  if (label === "Drying") return "score-pill score-yellow";
  return "score-pill score-red";
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

async function geocodeHome(homeQuery) {
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

async function fetchCrags() {
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

async function fetchCragWeather(crag) {
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
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
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

function ForecastOutlookRow({ forecast, compact = false }) {
  if (!forecast || forecast.length === 0) return null;

  return (
    <div className={`forecast-score-row ${compact ? "compact" : ""}`}>
      {forecast.map((day, index) => (
        <div className="forecast-score-item" key={`${day.day}-${index}`}>
          <span className="forecast-score-day">{day.day}</span>
          <span className={outlookClass(day.label)}>{day.label}</span>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <div className="top-pick-card skeleton-panel">
        <div className="skeleton-header-row">
          <div className="skeleton-photo" />
          <div className="skeleton-copy">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-chip-row">
              <div className="skeleton-chip" />
              <div className="skeleton-chip" />
            </div>
          </div>
        </div>
        <div className="skeleton-grid">
          <div className="skeleton-box" />
          <div className="skeleton-box" />
          <div className="skeleton-box" />
          <div className="skeleton-box" />
        </div>
      </div>

      <div className="alternates-grid">
        {[1, 2, 3].map((item) => (
          <div className="alternate-card skeleton-panel" key={item}>
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-line skeleton-line-sm" />
            <div className="skeleton-grid">
              <div className="skeleton-box" />
              <div className="skeleton-box" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maxHours, setMaxHours] = useState(3);
  const [style, setStyle] = useState("all");
  const [homeInput, setHomeInput] = useState(getInitialHome());
  const [homeBase, setHomeBase] = useState(getInitialHome());
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const cacheKey = `scoreResult:${homeBase}:${maxHours}:${style}`;
        const cached = getCache(cacheKey);
        if (cached && !cancelled) {
          setData(cached);
          setLoading(false);
        }

        const [crags, home] = await Promise.all([
          fetchCrags(),
          geocodeHome(homeBase),
        ]);

        // Fetch weather for each crag, but don't let one failure (e.g. 429
        // from Open-Meteo) wipe out the whole batch. Keep whatever succeeds.
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
          body: JSON.stringify({
            home,
            max_hours: maxHours,
            style,
            weather,
          }),
        });

        if (!cancelled) {
          setData(scored);
          setCache(cacheKey, scored);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Could not load current conditions.");
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [homeBase, maxHours, style]);

  function applyHomeBase() {
    localStorage.setItem("rockradarHome", homeInput);
    setHomeBase(homeInput);
  }

  const alternates = useMemo(() => data?.alternates?.slice(0, 3) || [], [data]);
  const nothingWorthDriving =
    data?.best_area === "Nothing worth the drive in range.";

  return (
    <div className="app-shell">
      <div className="container">
        <div className="hero-card">
          <div className="hero-text">
            <p className="eyebrow">Find best conditions near you</p>
            <h1>RockRadar</h1>
            <div className="hero-meta">
              <span className="meta-pill">Home: {data?.home || homeBase}</span>
              {data?.go_status && (
                <span className={goStatusClass(data.go_status)}>
                  {data.go_status}
                </span>
              )}
            </div>
          </div>

          <div className="hero-icon-wrap">
            <img
              src={handPhoto}
              className="hero-icon"
              alt="climbing hand on rock"
              loading="lazy"
            />
          </div>
        </div>

        <div className="controls-card">
          <div className="control-group control-group-wide">
            <label>Home base (zip or city/state)</label>
            <div className="home-row">
              <input
                type="text"
                value={homeInput}
                onChange={(e) => setHomeInput(e.target.value)}
                placeholder="98101 or Seattle, WA"
              />
              <button onClick={applyHomeBase}>Update</button>
            </div>
          </div>

          <div className="control-row">
            <div className="control-group">
              <label>Max drive time</label>
              <select value={maxHours} onChange={(e) => setMaxHours(Number(e.target.value))}>
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="3">3 hours</option>
                <option value="4">4 hours</option>
                <option value="6">6 hours</option>
                <option value="8">8 hours</option>
              </select>
            </div>

            <div className="control-group">
              <label>Climbing style</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="all">All</option>
                <option value="sport">Sport</option>
                <option value="trad">Trad</option>
                <option value="bouldering">Bouldering</option>
              </select>
            </div>
          </div>
        </div>

        {error ? <div className="message-card error-card">{error}</div> : null}

        {loading && !data ? (
          <LoadingSkeleton />
        ) : data ? (
          <>
            {nothingWorthDriving ? (
              <div className="message-card no-results-card">
                <h2>Nothing worth the drive in range.</h2>
                <p>Try changing the hours or climbing style.</p>
              </div>
            ) : null}

            <div className="top-pick-card">
              <div className="crag-header">
                <img
                  className="crag-photo"
                  src={getCragPhoto(data.best_area)}
                  alt={data.best_area}
                  loading="lazy"
                />

                <div className="crag-header-text">
                  <div className="crag-top-row">
                    <span className="rank-pill">Top Pick</span>
                    <span className={goStatusClass(data.go_status)}>{data.go_status}</span>
                    <span className={scoreClass(data.conditions_score)}>Score {data.conditions_score}</span>
                  </div>

                  <h2 className="crag-name">{data.best_area}</h2>
                  <p className="signal-summary">{data.signal_summary}</p>

                  <div className="crag-meta-line">
                    <span>{data.rock_type || "unknown rock"}</span>
                  </div>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-box">
                  <span className="stat-label">Drive</span>
                  <span className="stat-value">{data.drive_time} hrs</span>
                </div>

                <div className="stat-box">
                  <span className="stat-label">Best window</span>
                  <span className="stat-value">{data.best_window}</span>
                </div>

                <div className="stat-box">
                  <span className="stat-label">Overhang</span>
                  <span className="stat-value">{data.overhang || "n/a"}</span>
                </div>
              </div>

              <div className="conditions-card">
                <div className="section-card-head">
                  <h3>Conditions</h3>
                  <span className="freshness-text">{data.freshness_text}</span>
                </div>

                <div className="conditions-grid">
                  <div className="condition-pill">
                    <span>Temp</span>
                    <strong>{data.temperature}°F</strong>
                  </div>

                  <div className="condition-pill">
                    <span>Humidity</span>
                    <strong>{data.humidity}%</strong>
                  </div>

                  <div className="condition-pill">
                    <span>Dew Pt</span>
                    <strong>{data.dew_point}°F</strong>
                  </div>

                  <div className="condition-pill">
                    <span>Rain</span>
                    <strong>{data.rain}</strong>
                  </div>

                  <div className="condition-pill">
                    <span>Wind</span>
                    <strong>{data.wind}</strong>
                  </div>
                </div>
              </div>

              <div className="conditions-card">
                <div className="section-card-head">
                  <h3>Drying Outlook</h3>
                </div>

                <div className="conditions-grid">
                  <div className="condition-pill">
                    <span>Last rain</span>
                    <strong>{data.last_rain_event || "n/a"}</strong>
                  </div>

                  <div className="condition-pill">
                    <span>Estimated dry</span>
                    <strong>{data.estimated_dry || "n/a"}</strong>
                  </div>

                  <div className="condition-pill">
                    <span>Confidence</span>
                    <strong className={confidenceClass(data.drying_confidence)}>
                      {data.drying_confidence || "Low"}
                    </strong>
                  </div>
                </div>
              </div>

              {data.forecast && data.forecast.length > 0 && (
                <div className="forecast-card">
                  <div className="section-card-head">
                    <h3>5-Day Outlook</h3>
                  </div>
                  <ForecastOutlookRow forecast={data.forecast} />
                </div>
              )}

              <div className="why-card">
                <div className="section-card-head">
                  <h3>Why</h3>
                </div>
                <div className="signal-reasons">
                  {(data.signal_reasons || []).slice(0, 3).map((reason, index) => (
                    <p key={`${reason}-${index}`}>• {reason}</p>
                  ))}
                </div>
              </div>

              {!nothingWorthDriving && (
                <a
                  className="nav-button"
                  href={getMapLink(data.best_area)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Navigate
                </a>
              )}
            </div>

            <div className="alternates-section">
              <div className="alternates-header">
                <h2 className="alternates-title">Ranked Backups</h2>
              </div>

              <div className="alternates-grid">
                {alternates.map((alt, index) => (
                  <div className="alternate-card" key={alt.area}>
                    <div className="alternate-top">
                      <img
                        className="alternate-photo"
                        src={getCragPhoto(alt.area)}
                        alt={alt.area}
                        loading="lazy"
                      />

                      <div className="alternate-header-text">
                        <div className="crag-top-row">
                          <span className="rank-pill">#{index + 2}</span>
                          <span className={goStatusClass(alt.go_status)}>{alt.go_status}</span>
                          <span className={scoreClass(alt.conditions_score)}>Score {alt.conditions_score}</span>
                        </div>

                        <h3>{alt.area}</h3>
                        <div className="crag-meta-line">
                          <span>{alt.rock_type || "unknown rock"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="alternate-stats">
                      <div className="mini-stat">
                        <span>Drive</span>
                        <strong>{alt.drive_time} hrs</strong>
                      </div>

                      <div className="mini-stat">
                        <span>Dry by</span>
                        <strong>{alt.estimated_dry || "n/a"}</strong>
                      </div>

                      <div className="mini-stat">
                        <span>Status</span>
                        <strong className={goStatusClass(alt.go_status)}>
                          {alt.go_status}
                        </strong>
                      </div>
                    </div>

                    <div className="backup-forecast-block">
                      <span className="backup-forecast-label">5-Day Outlook</span>
                      <ForecastOutlookRow forecast={alt.forecast} compact />
                    </div>

                    <a
                      className="nav-button small"
                      href={getMapLink(alt.area)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Navigate
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <a
        className="feedback-fab"
        href={FEEDBACK_URL}
        target="_blank"
        rel="noreferrer"
        title="What would make this more sendy?"
      >
        What would make this more sendy?
      </a>
    </div>
  );
}

export default App;
