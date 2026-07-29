# RockRadar frontend redesign — summary

Map-first UX overhaul of `frontend/` to match professional outdoor-app
patterns (AllTrails, Mountain Project, OpenSnow). **Backend untouched** — the
`/api/crags` and `/api/score` contract is consumed exactly as-is; this is a
visual/structural rework, not a logic change. All existing scoring output and
weather math is preserved verbatim (moved, not modified).

> The previous pass's summary (backend rebuild) is kept below under
> **"Previous pass"** so this file stays a running log.

## What changed

### New information architecture: bottom tab bar
Added a fixed iOS-style bottom navigation (`Map · List · Saved · Profile`),
built with inline SVG icons (zero new icon deps). The app shell is now a
full-height flex column sized with `100dvh` + `env(safe-area-inset-bottom)`,
so it's ready to drop into a Capacitor iOS shell.

### 1. Map is the home screen (`screens/MapScreen.jsx` + `components/MapView.jsx`)
- Crags render as **status-colored pins** on a Leaflet + OpenStreetMap map
  (green = Go, amber = Maybe, red = No-Go, grey = unranked/out-of-range).
- Leaflet is driven **imperatively** through a thin `useEffect` wrapper rather
  than pulling in `react-leaflet` — one dependency instead of a peer-dep chain,
  and no React 19 compatibility friction. Pins are vector `circleMarker`s, so
  there are no marker-image assets to 404.
- The `/api/score` response only ranks the top 4 crags, so status is joined
  onto the full `/api/crags` list **by name** (via the shared
  `normalizeAreaKey`); crags with no score show as neutral grey pins. A blue
  dot marks the geocoded home base.
- Tapping a pin raises a **photo-led bottom sheet** card for that crag. A
  status legend sits top-right of the map.
- `fitBounds` is padded to reserve space for the top filter/legend overlay and
  the bottom sheet, so pins never hide under the chrome.

### 2. Ranked list is now the *secondary* tab (`screens/ListScreen.jsx`)
Same photo-led cards as the map sheet, shown full and in score order. This is
the old primary experience, demoted to a tab.

### 3. Photo-led cards, status-dominant (`components/CragCard.jsx`, `StatusBadge.jsx`)
Each card now **leads with the crag photo** (full-bleed, 16:10), with the crag
name overlaid on a gradient scrim. The **status badge is the loudest element
after the photo** — large, high-contrast, pill-shaped, with a colored dot.
`Top pick` / `#2` rank tags sit opposite it.

### 4. Secondary data de-emphasized
Temp / humidity / wind / dew-point / rain are grouped into a single muted,
small-type metric strip inside a recessed panel — deliberately quiet versus the
old design where every stat sat in its own prominent pill. Drying info and the
"why" reasons are smaller, muted, and grouped.

### 5. Saved + Profile stubs (`screens/SavedScreen.jsx`, `ProfileScreen.jsx`)
- **Saved**: static placeholder with an empty state that sets expectations
  ("favorites coming in a later update — nothing is saved yet"). No persistence
  added, per scope.
- **Profile**: stub that hosts the **trip settings** (home base, max drive,
  style) and the feedback link. No accounts/notifications.

### 6. Branding preserved
The hero hand photo stays — featured on the Profile screen as the brand mark
alongside the `RockRadar` wordmark. No logo or new color system beyond the
green/amber/red status palette (the one existing orange accent is retained only
on the Profile wordmark and the "Update" action).

### 7. Mobile responsiveness
Designed mobile-first and verified with headless Chromium at **390px and
360px** viewport widths (see "Verified"). No horizontal overflow; the layout
caps card width and floats the map sheet as a side panel at ≥720px.

### Filters (`components/FilterBar.jsx`)
The old always-visible controls card is replaced by a **collapsible filter
chip** on Map and List (`📍 Home · ≤Nh · Style` → expands to the controls) —
the standard outdoor-app pattern so filters don't eat the map. The same
controls appear expanded on Profile. **Wiring is unchanged**: editing home
applies on "Update"; hours/style apply immediately and re-trigger the fetch.

### Code structure
- `src/lib/api.js` — all data fetching (backend + Open-Meteo + Nominatim),
  caching, and weather math, **extracted verbatim** from the old `App.jsx`.
- `src/lib/crags.js` — crag photos, the status→color model (single source of
  truth), and `rankedCrags()`, which reconciles the score response's
  `best_area` vs `alternates[].area` into one uniformly-shaped list (shape
  only — no value changes).
- `src/App.jsx` — now a thin orchestrator: holds state, runs the (unchanged)
  fetch effect, and routes tabs.

### Small pre-existing fixes made along the way
- Removed a stray literal `k` at the very start of `frontend/index.html`
  (`k<!DOCTYPE html>`) that rendered as visible text in the top-left corner.
- `theme-color` (index.html) and `manifest.json` `theme_color`/`background_color`
  updated from white to the app's dark `#0b0d12`.
- `src/index.css` trimmed of the leftover Vite starter styles (centered flex
  body, link/button defaults, light-mode block) that fought the new full-height
  shell.

## Dependencies
- **Added:** `leaflet@^1.9.4` (the only new runtime dep). Adds ~155 KB min
  (~46 KB gzip) to the JS bundle — expected for an interactive map and the
  lightest option that meets the map-first goal. No API key required (OSM tiles).
- No UI framework, no icon font, no `react-leaflet`.

## Verified
- `npm run lint` — clean.
- `npm run build` — succeeds.
- **Headless Chromium** (Playwright, mocking the `/api/crags` + `/api/score`
  contract so the full UI renders deterministically) at **390×844** and
  **360×780**: captured Map, List, Saved, Profile, and the expanded filter
  panel. No page errors; no horizontal overflow. Confirmed all four pin colors
  render (Go/Maybe/No-Go/unknown) plus the home dot, the selected pin
  enlarges, and cards/tabs lay out correctly at both widths.

### Screenshot descriptions (images not committed)
- **Map**: dark map with the filter chip + status legend overlaid at top; six
  pins color-coded by status and a blue home dot; a photo-led bottom sheet for
  the selected "Index – River Boulders" showing a large green **Go** badge, a
  muted Temp/Humidity/Wind strip, drying line, and a full-width Navigate button.
- **List**: stacked photo-led cards in score order — "Top pick" + green **Go**
  on the first, "#2" + amber **Maybe** on the next — each with the muted metric
  strip and reasons.
- **Profile**: hand-photo brand mark + `RockRadar` wordmark, a Trip Settings
  panel (home base / max drive / style), an Account stub, and the feedback link.
- **Saved**: centered empty state with the hand photo and a "coming later" note.

## Open questions / notes for the human reviewer
- **OSM tile usage policy.** We use the public `tile.openstreetmap.org`
  endpoint directly. That's fine for this low-traffic beta, but OSM's tile-usage
  policy discourages heavy production use — before real scale, consider a proper
  tile host (e.g. free-tier MapTiler/Stadia/Carto) or self-hosting. Swapping is
  a one-line URL change in `MapView.jsx`.
- **Only 4 crags ever get a status.** `/api/score` returns best + 3 alternates,
  so on the map the remaining crags are grey "unranked". If the product wants
  every in-range crag colored, that's a backend change (return status for all
  scored crags) — intentionally not made here (backend is frozen this run).
- **Map zoom control is hidden** to keep the overlay clean; pinch, scroll-wheel,
  and keyboard (+/-) zoom remain. Re-enable Leaflet's zoom control if a visible
  button is preferred.
- **No dark/light OSM tile variant.** Tiles get a mild CSS brightness/saturation
  filter to sit better in the dark theme; a purpose-built dark tile set would
  look cleaner if the map becomes central.
- Favorites persistence, accounts, and notifications remain **stubs by design**
  (later phase).

---

# Previous pass: backend rebuild — summary

Autonomous overnight pass over `backend/` and the minimal frontend touches
needed to keep the API contract sane. No visual/UX changes.

## What changed

**Verified first, then fixed:**
- `/api/crags` and `/api/score` already matched what the frontend sends and
  expects — confirmed via a new pytest suite (`backend/test_main.py`, 18
  tests) and a live `uvicorn main:app` smoke test using Render's exact start
  command.
- Found and fixed a **real recommendation bug**: `post_score`'s "worthwhile"
  filter (`go_status != "No Go" or score >= 35`) could let an actively
  raining crag become the top pick if its secondary signals (sun, wind,
  humidity) pushed the score above 35, even though `go_status` correctly
  said "No Go". A test (`test_post_score_everything_wet_falls_back_to_gym_message`)
  caught this. Fixed by excluding any crag with active rain (`rain_now >
  0.05`) from the worthwhile set outright, regardless of score.
- The Go/No-Go ↔ rain invariant itself (`go_status` never "Go" while
  `rain_now > 0`) was already correct — added a test to lock it in.

**Data cleanup:**
- `backend/crags.json` was dead (nothing read it) but contained a
  `sun_exposure` field not present in `main.py`'s `CRAGS` list, plus 7 extra
  crags (Beacon Rock, Smith Rock x3, Squamish x3) that the frontend has no
  photos/UI support for. Reconciled the `sun_exposure` values for the 6
  crags `main.py` already serves into `CRAGS`, then deleted the file.
  **Caveat:** `sun_exposure` values came from a prior dev/AI pass and are
  not independently verified against real crag orientation — flagging for a
  human to sanity-check.
  **Not done:** did not add the 7 extra crags from `crags.json`. Doing so
  would require new frontend photo imports/`cragPhotos` entries and product
  review of an expanded crag list — out of scope for a backend cleanup pass
  that's asked not to change frontend UX.

**Scoring model (aspirational spec → implemented):**
- Renamed `dry_score` → `conditions_score` end-to-end (backend response
  fields, frontend consumption). No UI-visible label changes needed — the
  frontend only ever rendered `Score {value}`, never the words "Dry Score".
- Added real **days since last measurable rain**: the frontend now requests
  7 days of Open-Meteo daily history (`past_days=7`) and computes the actual
  gap by scanning `daily.precipitation_sum` backward from today, instead of
  the backend guessing an hours-since-rain estimate from a single 24h
  rain total. If no rain is found anywhere in the 7-day window, the value is
  reported as a capped lower bound (`"7+ days"`) rather than fabricated.
  This feeds a modest score bonus for confirmed dry streaks and replaces the
  old heuristic used for `last_rain_event` / `estimated_dry` / `drying_confidence`.
- Added **aspect / sun exposure** as a scoring input (priority 4), using the
  reconciled `sun_exposure` field: sunny aspects get a small bonus when cool
  (faster drying/warming) or a small penalty when already hot; shaded
  aspects get a small penalty when recently wet (slower to dry). Kept
  deliberately light-touch per the "don't force it" guidance.
- Did not implement rock-type-specific drying coefficients (priority 5) or
  user climbing-style-as-scoring-input (priority 11, beyond the existing
  style *filter*) — the existing signals already cover most of the
  practical value and adding more felt like complexity for little payoff
  tonight. Flagging as a gap, not a decision made silently.

**Bug fix in the frontend weather fetch (found while wiring up days-since-rain):**
- `rain_24h` was computed via `hourlyPrecip.slice(-24)`. Open-Meteo's hourly
  array spans `[past_days .. forecast_days]` with "now" in the middle, not
  at the end — so `slice(-24)` was grabbing the last 24 hours of the
  5-day *forecast* (future), not the trailing 24 actual hours. Fixed by
  locating `current.time` in `hourly.time` and taking the 24 values ending
  there.
- Related: the "5-Day Outlook" forecast list was built from
  `data.daily.time` starting at index 0, but with `past_days` set, index 0
  is *yesterday*, not today — so "Today"/"Tomorrow" labels (and the
  backend's `best_window`/near-term-forecast-rain scoring) were off by one
  day. Fixed by slicing the daily arrays from the actual today-index
  forward.

**Config / hygiene:**
- `frontend/src/App.jsx`: `API_BASE` now reads
  `import.meta.env.VITE_API_BASE`, falling back to the existing
  `https://rockradar-backend.onrender.com` if unset. Added
  `frontend/.env.example` documenting it.
- `backend/requirements.txt` trimmed to the 3 actually-imported top-level
  packages (`fastapi`, `pydantic`, `uvicorn`).
- Added `backend/requirements-dev.txt` (`pytest`, `httpx`).
- CORS: switched to `allow_credentials=False`, narrowed `allow_methods` to
  `GET, POST`.
- Added input validation: `lat`/`lon` bounds, `max_hours` in `(0, 24]`,
  `style` restricted to the 4 real values, empty `weather` list rejected
  with a 400, per-crag scoring wrapped so one malformed weather entry
  degrades gracefully.
