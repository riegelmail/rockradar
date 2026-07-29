# RockRadar frontend redesign — summary

A visual + structural rework of the `frontend/` React app to match
professional outdoor-app UX (AllTrails / Mountain Project / OpenSnow). The
backend (`/api/crags`, `/api/score`) was treated as a fixed contract and
**not touched** — all scoring and data values are unchanged. This is a
presentation-layer change only.

## What changed

### From: single scrolling "top pick + backups" page
The old app was one long scroll — a hero, a controls card, one big top-pick
card dense with data, then a grid of backup cards. Data led; photos and the
Go/No-Go verdict were secondary.

### To: a map-first, four-tab mobile app

**1. Map (home tab).** A full-screen [Leaflet](https://leafletjs.com/) map on
a CARTO dark basemap (OpenStreetMap data, free, no API key). Every crag is a
teardrop pin **colour-coded by status** — green = Go, amber = Maybe, red =
No-Go. Your home base shows as a blue dot. Crags the backend filtered out
(out of drive range / wrong style / actively wet) still appear as muted gray
pins so the map isn't misleadingly empty; tapping one explains why it has no
score. Tapping a scored pin opens a bottom sheet with the photo, status
badge, score, quick conditions, and a Navigate button. A small legend sits
top-right.

**2. List (secondary tab).** The ranked view, no longer the primary screen.
Each crag is a card that **leads with a real photo** (16:9), with the
**Go/Maybe/No-Go badge as the most dominant element after the photo**
(large, top-left overlay) and the rank as a chip top-right. Below: name +
score chip, one-line summary, a facts row (drive time emphasised), then the
**secondary weather grouped and visually de-emphasised** — temp, humidity,
dew point, wind, rain in small muted type inside a subdued strip. A "Details"
toggle expands the drying outlook, 5-day forecast, and the "why" reasons. The
top pick is expanded by default.

**3. Saved (stub).** Static placeholder empty state. No persistence or
favorites logic — that's a later phase, per the brief.

**4. Profile (stub + home base).** Hosts the home-base editor (moved off the
main screens so Map/List stay focused on conditions), an About blurb, the
existing feedback link, and a "coming soon" Accounts placeholder.

### Cross-cutting
- **Bottom navigation bar** (Map / List / Saved / Profile) is the primary nav.
- **Slim filter bar** (drive time + climbing style) stays always-visible on
  Map and List. All three original controls (home, drive time, style) are
  preserved and drive the exact same `/api/score` request as before.
- **Branding kept minimal**: the hero hand photo stays (now a header
  thumbnail). Status green/amber/red is the *only* real colour system;
  interactive chrome (buttons, selects) is neutral. The old orange brand
  accent was retired in favour of letting status colour carry the signal.
- **Mobile-first + Capacitor-ready**: fixed header / filter / scrolling main /
  bottom-nav layout that fills the viewport (`100dvh`) and respects iOS
  safe-area insets (`env(safe-area-inset-*)`, `viewport-fit=cover`). Verified
  at 320px and 390px widths.

## Structure

```
src/
  App.jsx                    tab shell + shared conditions loader
  lib/
    conditions.js            all backend/weather API calls (lifted verbatim
                             from the old App.jsx — contract unchanged)
    status.js                Go/Maybe/No-Go colour system + toRankedCrags()
  components/
    AppHeader.jsx  FilterBar.jsx  BottomNav.jsx
    MapView.jsx    ListView.jsx   CragCard.jsx  ForecastRow.jsx
    StatusBadge.jsx  SavedView.jsx  ProfileView.jsx
```

The data layer was extracted **verbatim** so the score/weather logic and the
request/response shape are byte-for-byte identical to before. `MapView` and
`CragCard` join scored `go_status` onto crags purely for display.

## API contract — untouched

- `GET /api/crags` → `[{name, lat, lon}]` — used for pin coordinates.
- `POST /api/score` → same body (`{home, max_hours, style, weather}`) and same
  response fields consumed as before. `toRankedCrags()` only reshapes the
  existing `best_*` + `alternates[]` fields into a uniform list for rendering.

## Dependencies

- Added: `leaflet` (~1.9.4) — lightweight, no API key. Production bundle grew
  from ~65 KB to ~112 KB gzipped, essentially all Leaflet. No heavy UI
  framework was introduced.

## Verification

- `npm run lint` — clean.
- `npm run build` — succeeds.
- Rendered in headless Chromium at 390px and 320px across all four tabs; pins
  render for all 6 crags in the correct status colours, the bottom sheet and
  detail toggles work, and there's no horizontal overflow at 320px.

Screenshots in `docs/screenshots/` (`map.png`, `map-sheet.png`, `list.png`,
`saved.png`, `profile.png`). **Note:** these were captured in a sandbox
without outbound network, so API responses and map tiles were mocked — the
map background is a flat placeholder tile, not the real CARTO dark basemap,
and the pin *positions/colours* are real but sit on a blank surface. Live,
the map renders the dark street basemap under the pins.

## Open questions / follow-ups

1. **Basemap choice.** I used CARTO's dark basemap (OSM data) for cohesion
   with the dark UI instead of the stock light OSM raster. If you'd rather
   stay on raw `tile.openstreetmap.org`, it's a one-line change in
   `MapView.jsx` (`TILE_URL`/`TILE_ATTR`) — but the light tiles clash with the
   dark theme. Worth a design call.
2. **Map coverage of non-scored crags.** The `/api/score` response only
   returns the best pick + up to 3 worthwhile alternates, so the map can only
   colour those; the rest are shown as neutral "not in range" pins. If we want
   *every* crag coloured regardless of range/rain, the backend would need to
   expose a per-crag status list — out of scope here since the contract is
   fixed, but flagging it as the natural next contract change.
3. **Light vs dark theme.** Kept the existing dark theme. AllTrails-style light
   is an option if we want to lean more "outdoors daytime," but that's a bigger
   visual change and touches the photos/hero.
4. **Saved & Profile** are intentionally static stubs pending the accounts /
   favorites phase.
5. **Pre-existing:** `index.html` still registers `/service-worker.js`, which
   isn't in the repo (404s silently). Left as-is — unrelated to this redesign.
