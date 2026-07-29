import { useState } from "react";
import "./App.css";

import { useConditions } from "./hooks/useConditions";
import { DEFAULT_HOME } from "./lib/api";

import BottomNav from "./components/BottomNav";
import FilterBar from "./components/FilterBar";
import MapScreen from "./screens/MapScreen";
import ListScreen from "./screens/ListScreen";
import SavedScreen from "./screens/SavedScreen";
import ProfileScreen from "./screens/ProfileScreen";

function getInitialHome() {
  if (typeof window === "undefined") return DEFAULT_HOME.name;
  return localStorage.getItem("rockradarHome") || DEFAULT_HOME.name;
}

export default function App() {
  const [tab, setTab] = useState("map");
  const [homeBase, setHomeBase] = useState(getInitialHome());
  const [maxHours, setMaxHours] = useState(3);
  const [style, setStyle] = useState("all");
  // undefined = auto (fall back to top pick); null = explicitly closed;
  // string = a pin the user tapped. Deriving the fallback during render (vs.
  // an effect) keeps "close the sheet" from instantly reopening on the best.
  const [selection, setSelection] = useState(undefined);

  const {
    homeGeo,
    mappedCrags,
    rankedCrags,
    loading,
    error,
    nothingWorthDriving,
    data,
  } = useConditions({ home: homeBase, maxHours, style });

  const selectedName =
    selection === undefined ? rankedCrags[0]?.name ?? null : selection;

  function applyHome(next) {
    localStorage.setItem("rockradarHome", next);
    setHomeBase(next);
  }

  function updateFilters(patch) {
    if (patch.maxHours != null) setMaxHours(patch.maxHours);
    if (patch.style != null) setStyle(patch.style);
    setSelection(undefined);
  }

  const showFilters = tab === "map" || tab === "list";

  return (
    <div className="app-shell">
      {error && (tab === "map" || tab === "list") ? (
        <div className="app-error-banner">{error}</div>
      ) : null}

      {showFilters ? (
        <FilterBar maxHours={maxHours} style={style} onChange={updateFilters} />
      ) : null}

      <main className={`app-main ${tab === "map" ? "app-main-map" : ""}`}>
        {tab === "map" ? (
          <MapScreen
            mappedCrags={mappedCrags}
            homeGeo={homeGeo}
            selectedName={selectedName}
            onSelect={setSelection}
            loading={loading}
          />
        ) : null}

        {tab === "list" ? (
          <ListScreen
            rankedCrags={rankedCrags}
            loading={loading}
            error={error}
            nothingWorthDriving={nothingWorthDriving}
          />
        ) : null}

        {tab === "saved" ? <SavedScreen /> : null}

        {tab === "profile" ? (
          <ProfileScreen home={data?.home || homeBase} onApplyHome={applyHome} />
        ) : null}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
