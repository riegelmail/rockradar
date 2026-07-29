# RockRadar frontend redesign — summary

A visual + structural rework of the `frontend/` (React + Vite) to match the
UX patterns of professional outdoor apps (AllTrails, Mountain Project,
OpenSnow): **map-first, photo-led, status-forward, bottom-tab navigation.**

**The backend was not touched.** `/api/crags` and `/api/score` are consumed
exactly as before — same request bodies, same response shapes. This is a
presentation change only; all scoring logic and data values are unchanged.

## What changed

### New: map-first home screen (`Map` tab)
- Crags are pins on a **Leaflet + OpenStreetMap** map (free tiles, no API key,
  no account). Added one dependency: `leaflet@^1.9.4`.
- Pins are **color-coded by status**: green = Go, amber = Maybe, red = No-Go,
  gray = Unranked. The home base shows as a distinct blue marker.
- Tapping a pin raises a **bottom sheet** with that crag's full card. The map
  opens focused on the top pick; tapping the map or the sheet's ✕ closes it.
- A small legend and a "Tap a pin for conditions" hint orient first-time users.

> **Why some pins are gray (Unranked):** `/api/score` only ranks crags that are
> within the drive-time filter and match the style filter, and it returns just
> the best pick + up to 3 alternates. The map still needs a pin for *every*
> crag (from `/api/crags`), so any crag the backend didn't score is shown gray
> rather than invented a status. Widening the filters scores more of them.

### Ranked list is now secondary (`List` tab)
- The old single-screen "top pick + backups" layout became a scrollable
  leaderboard. #1 gets the full detailed card; the rest are compact but still
  photo-led.

### Card redesign (photo → badge → name → muted data)
Each `CragCard` now reads in this deliberate order:
1. **A real photo of the crag** leads (16:10, full-bleed).
2. The **Go / Maybe / No-Go badge** is the dominant element after the photo —
   large, high-contrast, overlaid on the photo's lower-left. Rank and score
   sit as small chips in the photo corners.
3. Crag name + one-line summary.
4. **Secondary data is de-emphasized**: temp / humidity / dew point / wind /
   rain and the drying outlook are now small, muted, and grouped into labeled
   panels below the fold, instead of dominating the screen as before.

### Bottom navigation
- Fixed bottom bar with **Map · List · Saved · Profile** (inline SVG icons, no
  icon-font/library dependency), with iOS safe-area padding.
- **Saved** — placeholder screen (favorites/accounts are a later phase).
- **Profile** — keeps the **hero hand photo** (the one retained piece of
  branding) and hosts the persistent Home-base setting plus a stub Account
  card and the existing feedback link.

### Branding / color
- No logo or new color system was introduced. The only color language is the
  status traffic light (green/amber/red), used consistently for badges, pins,
  legend, and forecast chips. Light, neutral surface theme otherwise.

### Mobile responsiveness
- Mobile-first, built and screenshotted at a 390px (iPhone-class) viewport.
- The app renders as a phone-width column (`max-width: 480px`) centered inside
  a device-like frame on wider screens, so it previews the eventual Capacitor
  iOS build. Uses `100dvh`, `env(safe-area-inset-bottom)`, and
  `prefers-reduced-motion` handling.

## File structure (new)
```
src/
  lib/
    api.js            # all network + cache + normalize logic (moved out of App.jsx)
    format.js         # crag photos, status model, formatters
  hooks/
    useConditions.js  # loads crags + score, derives map/list view models
  components/
    StatusBadge.jsx   ForecastRow.jsx   ConditionStats.jsx
    CragCard.jsx      BottomNav.jsx     FilterBar.jsx
  screens/
    MapScreen.jsx     ListScreen.jsx    SavedScreen.jsx    ProfileScreen.jsx
  App.jsx             # thin shell: tab state + filters + bottom nav
  App.css  index.css  # rewritten, status-driven design system
```
The previous monolithic `App.jsx` (~700 lines of fetch + render) was split so
the data layer is testable/reusable and each screen is self-contained. All the
fetch/caching/day-offset logic was preserved verbatim during the move.

## Preserved behavior (unchanged contract)
- `/api/crags` and `POST /api/score` request/response usage is identical.
- 25-minute localStorage caching, per-crag Open-Meteo fetch with graceful
  per-request failure, Nominatim home geocoding, the rain-24h / days-since-rain
  math, and the "Nothing worth the drive in range" empty state all carry over.
- Drive-time and style filters still drive the score request; home base still
  persists to `localStorage` under `rockradarHome`.

## Incidental fix
- `frontend/index.html` began with a stray `k` before `<!DOCTYPE html>` (it
  rendered as visible text in the top-left corner). Removed.

## Verification
- `npm run lint` — clean. `npm run build` — succeeds (54 modules).
- Screenshotted all four tabs at 390px via headless Chromium with the API
  mocked (the sandbox's headless browser can't reach the live backend/tiles
  through the proxy). Verified pin colors map correctly to status
  (`Go→green, Maybe→amber, No-Go→red, Unranked→gray`) and the home marker,
  legend, and detail sheet all render.

## Open questions / follow-ups
- **Map coverage vs. the score API.** Because `/api/score` returns only the top
  4 crags, the map can color at most 4 pins; the rest are gray. If the product
  wants *every* in-range crag colored on the map, the backend would need an
  endpoint that returns a status for all scored crags (out of scope here — the
  contract was frozen for this run).
- **OSM tile usage policy.** We use the public OpenStreetMap tile server, which
  is fine for this low-volume prototype but not for production scale; a tile
  provider (or self-hosted tiles) should be chosen before wide release.
- **Saved tab** is a static placeholder — favorites persistence, accounts, and
  condition alerts are the explicitly-deferred next phase.
- **Photos** are the existing bundled crag images; a couple of crags share a
  fallback image. Sourcing a dedicated, rights-cleared photo per crag is a nice
  follow-up now that photos lead every card.

## Screenshots (described)
- **Map:** full-bleed map, status-colored pins around the Seattle/Cascades
  region, blue home marker, legend top-left, top-pick detail sheet raised from
  the bottom showing the Vantage photo with a large green **Go** badge.
- **List:** "Ranked crags" header, stacked photo-led cards, #1 detailed with
  Conditions + Drying-outlook panels and a 5-day chip row.
- **Saved:** centered bookmark icon + "coming in a later release" copy.
- **Profile:** hand-photo avatar + "RockRadar", Home-base editor, Account stub,
  feedback link.
