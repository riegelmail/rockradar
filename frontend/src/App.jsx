import { useEffect, useMemo, useState } from "react";
import "./App.css";

import BottomNav from "./components/BottomNav";
import MapScreen from "./screens/MapScreen";
import ListScreen from "./screens/ListScreen";
import SavedScreen from "./screens/SavedScreen";
import ProfileScreen from "./screens/ProfileScreen";

import { rankedCrags } from "./lib/crags";
import {
  getInitialHome,
  getCache,
  setCache,
  settle,
  fetchCrags,
  geocodeHome,
  fetchCragWeather,
  scoreCrags,
} from "./lib/api";

function App() {
  const [data, setData] = useState(null);
  const [crags, setCrags] = useState([]); // raw list w/ lat/lon, for the map
  const [homeGeo, setHomeGeo] = useState(null); // geocoded home, for the map
  const [loading, setLoading] = useState(true);
  const [maxHours, setMaxHours] = useState(3);
  const [style, setStyle] = useState("all");
  const [homeInput, setHomeInput] = useState(getInitialHome());
  const [homeBase, setHomeBase] = useState(getInitialHome());
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("map");

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

        const [cragList, home] = await Promise.all([
          fetchCrags(),
          geocodeHome(homeBase),
        ]);

        if (!cancelled) {
          setCrags(cragList);
          setHomeGeo(home);
        }

        // Fetch weather for each crag, but don't let one failure (e.g. 429
        // from Open-Meteo) wipe out the whole batch. Keep whatever succeeds.
        const settled = await Promise.all(
          cragList.map((crag) => settle(fetchCragWeather(crag)))
        );
        const weather = settled
          .filter((result) => result.ok && result.value)
          .map((result) => result.value);

        if (weather.length === 0) {
          throw new Error("All weather requests failed");
        }

        const scored = await scoreCrags({ home, maxHours, style, weather });

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

  const ranked = useMemo(() => rankedCrags(data), [data]);

  const filterProps = {
    homeInput,
    setHomeInput,
    onApplyHome: applyHomeBase,
    homeLabel: data?.home || homeBase,
    maxHours,
    setMaxHours,
    style,
    setStyle,
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        {activeTab === "map" && (
          <MapScreen
            crags={crags}
            ranked={ranked}
            home={homeGeo}
            loading={loading}
            error={error}
            filterProps={filterProps}
          />
        )}

        {activeTab === "list" && (
          <ListScreen
            ranked={ranked}
            loading={loading}
            error={error}
            filterProps={filterProps}
          />
        )}

        {activeTab === "saved" && <SavedScreen />}

        {activeTab === "profile" && (
          <ProfileScreen
            homeInput={homeInput}
            setHomeInput={setHomeInput}
            onApplyHome={applyHomeBase}
            maxHours={maxHours}
            setMaxHours={setMaxHours}
            style={style}
            setStyle={setStyle}
          />
        )}
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}

export default App;
