import { useEffect, useState } from "react";
import "./App.css";

import AppHeader from "./components/AppHeader";
import BottomNav from "./components/BottomNav";
import FilterBar from "./components/FilterBar";
import MapView from "./components/MapView";
import ListView from "./components/ListView";
import SavedView from "./components/SavedView";
import ProfileView from "./components/ProfileView";
import RegionScreen from "./components/RegionScreen";

import {
  loadConditions,
  getScoreCache,
  getInitialHome,
  getInitialRegion,
  REGIONS,
} from "./lib/conditions";

const TAB_TITLES = {
  map: "Map",
  list: "List",
  saved: "Saved",
  profile: "Profile",
};

export default function App() {
  const [region, setRegion] = useState(getInitialRegion());
  const [tab, setTab] = useState("map");

  const [data, setData] = useState(null);
  const [crags, setCrags] = useState([]);
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [maxHours, setMaxHours] = useState(3);
  const [style, setStyle] = useState("all");
  const [homeInput, setHomeInput] = useState(getInitialHome());
  const [homeBase, setHomeBase] = useState(getInitialHome());

  useEffect(() => {
    if (!region) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      // Show the last good score instantly while we refresh in the background.
      const cached = getScoreCache({ homeBase, maxHours, style, region });
      if (cached && !cancelled) {
        setData(cached);
        setLoading(false);
      }

      try {
        const result = await loadConditions({ homeBase, maxHours, style, region });
        if (cancelled) return;
        setData(result.data);
        setCrags(result.crags);
        setHome(result.home);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError("Could not load current conditions.");
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [region, homeBase, maxHours, style]);

  function applyHome() {
    localStorage.setItem("rockradarHome", homeInput);
    setHomeBase(homeInput);
    setTab("map");
  }

  function selectRegion(id) {
    localStorage.setItem("rockradarRegion", id);
    setRegion(id);
  }

  function switchRegion() {
    localStorage.removeItem("rockradarRegion");
    setRegion(null);
    setData(null);
    setCrags([]);
    setHome(null);
    setTab("map");
  }

  if (!region) {
    return <RegionScreen onSelect={selectRegion} />;
  }

  const regionName = REGIONS.find((r) => r.id === region)?.name || region;

  const goStatus =
    data && data.best_area !== "Nothing worth the drive in range."
      ? data.go_status
      : null;
  const activeHome = data?.home || homeBase;
  const showFilters = tab === "map" || tab === "list";

  return (
    <div className="app-shell">
      <AppHeader
        title={TAB_TITLES[tab]}
        home={activeHome}
        goStatus={goStatus}
        onHomeClick={() => setTab("profile")}
      />

      {showFilters && (
        <FilterBar
          maxHours={maxHours}
          style={style}
          onMaxHours={setMaxHours}
          onStyle={setStyle}
        />
      )}

      {error && <div className="error-banner">{error}</div>}

      <main className={`app-main app-main-${tab}`}>
        {/* MapView stays mounted so Leaflet keeps its state across tab
            switches; it's just hidden when another tab is active. */}
        <div className={`tab-pane ${tab === "map" ? "visible" : "hidden"}`}>
          <MapView
            data={data}
            crags={crags}
            home={home}
            loading={loading}
            active={tab === "map"}
          />
        </div>

        {tab === "list" && <ListView data={data} loading={loading} />}
        {tab === "saved" && <SavedView />}
        {tab === "profile" && (
          <ProfileView
            homeInput={homeInput}
            onHomeInput={setHomeInput}
            onApplyHome={applyHome}
            activeHome={activeHome}
            regionName={regionName}
            onSwitchRegion={switchRegion}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
