# RockRadar backend rebuild — summary

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
  forward. I could not verify this against the live API directly — outbound
  network access to `api.open-meteo.com` is blocked in this sandbox — so
  this is based on Open-Meteo's documented `past_days` behavior, not an
  empirical trace. **Recommend a human spot-check the 5-Day Outlook and
  rain_24h values against real conditions after deploy.**

**Config / hygiene:**
- `frontend/src/App.jsx`: `API_BASE` now reads
  `import.meta.env.VITE_API_BASE`, falling back to the existing
  `https://rockradar-backend.onrender.com` if unset. Added
  `frontend/.env.example` documenting it. **No Vercel env var is required**
  — the fallback keeps today's behavior working unchanged. Set
  `VITE_API_BASE` in Vercel only if you want to point at a different
  backend.
- `backend/requirements.txt` trimmed from 19 pinned packages (a raw `pip
  freeze`, including `requests` and `python-dotenv`, neither imported
  anywhere in `main.py`) down to the 3 actually imported top-level packages
  (`fastapi`, `pydantic`, `uvicorn`), letting pip resolve their real
  transitive deps. Verified this installs cleanly and boots via `uvicorn
  main:app` in a fresh venv.
- Added `backend/requirements-dev.txt` (`pytest`, `httpx`) for running
  tests locally; not needed in production.
- CORS: `allow_credentials=True` combined with `allow_origins=["*"]` is a
  known anti-pattern (and the app doesn't use cookies/auth), so switched to
  `allow_credentials=False`. Also narrowed `allow_methods` to `GET, POST`
  (the only methods the API exposes).
- Added input validation: `lat`/`lon` bounds, `max_hours` in `(0, 24]`,
  `style` restricted to the 4 real values, empty `weather` list rejected
  with a 400, and per-crag scoring wrapped so one malformed weather entry
  degrades gracefully (crag skipped) instead of 500ing the whole request.

## Verified

- `backend/test_main.py`: 18 tests, all passing — crags endpoint shape,
  score endpoint happy paths (style filter, out-of-range, all-wet fallback),
  validation (bad style/hours/lat, empty weather, missing fields), the
  Go/rain invariant, score bounds, days-since-rain fallback/capping, and the
  active-rain worthwhile-filter fix. Run with:
  `pip install -r backend/requirements-dev.txt && pytest backend/test_main.py`
- `uvicorn main:app --host 0.0.0.0 --port 8123` (Render's exact start
  command) boots and serves `/api/crags` correctly in a clean venv built
  from the trimmed `requirements.txt`.
- `npm run build` and `npm run lint` both pass clean in `frontend/`.

## Uncertain / risks taken given full autonomy

- **`sun_exposure` data provenance is unverified.** I reused values already
  present in the (now-deleted) `crags.json` rather than fabricate new ones,
  per the instruction to skip or placeholder rather than invent — but I
  can't personally confirm these reflect real crag aspect. Worth a human
  check.
- **Could not empirically verify the Open-Meteo response shape** (network to
  `api.open-meteo.com` is blocked from this sandbox). The `past_days`
  array-shift behavior driving both the `rain_24h` fix and the forecast
  day-offset fix is based on documented API behavior, not a live trace.
  Recommend watching the app after deploy to confirm the 5-Day Outlook and
  rain numbers look sane.
- **Extra crags in the old `crags.json` were dropped, not migrated.** If the
  product actually wants Beacon Rock / Smith Rock / Squamish, that's a
  bigger change (frontend photo imports, `cragPhotos` map, product review)
  than this pass covers.
- No paid services, new API keys, or new frameworks were introduced.
