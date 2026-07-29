import { useEffect, useMemo, useState } from "react";
import { getCache, setCache, loadConditions } from "../lib/api";
import { statusFromGoStatus, STATUS } from "../lib/format";

// Loads and manages the conditions state for the whole app: the raw crag list
// (for map pins), the geocoded home, and the scored /api/score response. Keyed
// on the filter inputs so changing home / drive time / style refetches.
//
// Also derives a `mappedCrags` array that joins the score results back onto
// the crag coordinates by name — the map needs lat/lon for every pin, but the
// backend only ranks crags that are in range and match the style filter, so
// crags without a score fall back to an "unranked" (gray) status.
export function useConditions({ home, maxHours, style }) {
  const [crags, setCrags] = useState([]);
  const [homeGeo, setHomeGeo] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      const cacheKey = `scoreResult:${home}:${maxHours}:${style}`;
      const cached = getCache(cacheKey);
      if (cached && !cancelled) {
        setData(cached);
        setLoading(false);
      }

      const cachedCrags = getCache("cragList");
      if (cachedCrags && !cancelled) setCrags(cachedCrags);

      try {
        const {
          crags: cragList,
          scored,
          home: homeCoords,
        } = await loadConditions({ home, maxHours, style });
        if (cancelled) return;
        setCrags(cragList);
        setHomeGeo(homeCoords);
        setData(scored);
        setCache(cacheKey, scored);
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
  }, [home, maxHours, style]);

  // A flat, name-keyed lookup of every scored crag (best pick + alternates)
  // so we can attach status/score/details to each map pin.
  const scoredByArea = useMemo(() => {
    const map = new Map();
    if (!data || data.best_area === "Nothing worth the drive in range.") {
      return map;
    }
    const best = { ...data, area: data.best_area, rank: 1 };
    map.set(best.area, best);
    (data.alternates || []).forEach((alt, i) => {
      map.set(alt.area, { ...alt, rank: i + 2 });
    });
    return map;
  }, [data]);

  const mappedCrags = useMemo(() => {
    return crags.map((crag) => {
      const scored = scoredByArea.get(crag.name);
      const status = scored
        ? statusFromGoStatus(scored.go_status)
        : STATUS.unranked;
      return { ...crag, scored: scored || null, status };
    });
  }, [crags, scoredByArea]);

  // Ranked crags (best + alternates), in score order, with coordinates joined
  // back on for anything that wants both (the list and the map sheet).
  const rankedCrags = useMemo(() => {
    const byName = new Map(crags.map((c) => [c.name, c]));
    return Array.from(scoredByArea.values())
      .sort((a, b) => a.rank - b.rank)
      .map((scored) => {
        const coords = byName.get(scored.area);
        const status = statusFromGoStatus(scored.go_status);
        return {
          name: scored.area,
          lat: coords?.lat,
          lon: coords?.lon,
          scored,
          status,
        };
      });
  }, [crags, scoredByArea]);

  const nothingWorthDriving =
    data?.best_area === "Nothing worth the drive in range.";

  return {
    data,
    crags,
    homeGeo,
    mappedCrags,
    rankedCrags,
    loading,
    error,
    nothingWorthDriving,
  };
}
