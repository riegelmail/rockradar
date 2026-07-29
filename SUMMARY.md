# RockRadar backend rebuild — summary

Autonomous pass over `backend/` (and the minimal `frontend/` touches needed to
keep the contract consistent). Everything below was verified locally before
pushing: backend via a real pytest suite + a live `uvicorn` boot + `curl`, and
the frontend via `npm run build`, `npm run lint`, and a headless-browser
(Playwright) load of the running Vite dev server pointed at the local backend.

## What changed

**Data cleanup**
- `backend/crags.json` was dead — nothing in `main.py` read it, and it
  disagreed with the live 6-crag list (different lat/lon, numeric vs. string
  `overhang`, and a `sun_exposure` field the live data didn't have). Rather
  than deleting it outright, I reconciled the one piece of real, non-fabricated
  value it had — `sun_exposure` per crag — into `main.py`'s `CRAGS` list for
  the 6 crags that exist in both, then deleted the file. There is exactly one
  source of truth for crag data now.
- `crags.json` also contained 6 *additional* crags (Beacon Rock, Smith Rock x3,
  Squamish x3) that aren't in `main.py` or the frontend's `cragPhotos` map —
  but matching photo assets for all of them already exist in
  `frontend/src/assets/crags/` (unused). I did **not** add these tonight:
  doing so would require drive-time estimates from the reference home for
  three new regions (WA Gorge, Central Oregon, BC), and I didn't have a
  reliable, non-fabricated source for those numbers. This is a real,
  low-risk expansion opportunity for a human to pick up — the photos are
  already sitting there ready to use.

**Scoring model**
- Added `sun_exposure` as a scoring input (task priority #6, previously
  missing): a multiplier on drying-related penalties/estimates — sunny
  aspects dry faster, shaded ones hold moisture longer. Uses the real
  `sun_exposure` values reconciled from `crags.json` above, not fabricated
  numbers.
- Added real "days since last measurable rain" tracking (task priority #4,
  previously missing — the backend only ever saw a single 24h window). The
  frontend now requests 7 days of Open-Meteo hourly history instead of 1, and
  computes `days_since_rain` by scanning backward from "now" for the last
  hour with ≥0.1mm precipitation. This feeds a decaying score penalty for
  wet-sensitive crags and drives `last_rain_event` / `estimated_dry` directly
  instead of the old `rain_24h * 4`-style guess. It's optional in the API —
  `main.py` falls back to the old 24h-only heuristic if `days_since_rain` is
  absent, so nothing breaks if a client doesn't send it.
- **Found and fixed a real bug** while touching this code: the old
  `rain_24h` computation did `hourlyPrecip.slice(-24)` against an array that
  contained `past_days` history *and* `forecast_days` future hours
  concatenated together. With `past_days=1, forecast_days=5`, the last 24
  entries of that array were hours 4-5 days in the *future*, not the last 24
  hours from now — so "rain in the last 24h" was silently reading forecasted
  rain instead of historical rain. Rewrote it to anchor on `current.time`
  (Open-Meteo's own "now" marker within the hourly array) and slice the 24
  hours ending there. I could not hit the live Open-Meteo API from this
  sandbox to verify against real data (outbound network to it is blocked
  here), so this is verified against documented API behavior, not a live
  response — worth a spot-check against production logs after deploy.
- Simplified the Go/Maybe/No-Go thresholds so "Go" structurally cannot
  coincide with active rain: `No Go` if `rain_now > 0` or `score < 50`,
  `Go` if `score >= 75`, else `Maybe`. (The old logic used `rain_now > 0.05`
  for the No-Go check but `rain_now == 0` for the Go check — not actually
  broken, since Go still required exactly zero rain, but the asymmetric
  thresholds were confusing and are now unified on one invariant, covered by
  a test.)
- Renamed `dry_score` → `conditions_score` everywhere in the backend
  response and the frontend (`App.jsx` field reads and the score-pill CSS
  class helper). No user-visible label changed — the UI only ever showed
  "Score {n}", never the words "Dry Score".

**API / frontend contract**
- `frontend/src/App.jsx`: `API_BASE` is now
  `import.meta.env.VITE_API_BASE || "https://rockradar-backend.onrender.com"`.
  Added `frontend/.env.example` documenting `VITE_API_BASE` (had to add a
  `!.env.example` negation to `.gitignore`, which blanket-ignored `.env.*`).
  No env var is required on Render or Vercel for this to work — the fallback
  is the current production URL.
- Added backend input validation via Pydantic: `home.lat`/`home.lon` bounds
  (-90..90 / -180..180), `max_hours > 0`, and `style` restricted to the known
  set (`all` + each crag style) — all previously unvalidated and would have
  produced silently-wrong results (e.g. a negative `max_hours` excluded every
  crag and fell through to "nothing worth the drive" instead of a clear
  error). Malformed values now get a 422 instead of a confusing 200.
- Wrapped per-crag scoring in `post_score` in a `try/except` so one crag with
  a malformed weather payload (e.g. a non-numeric field) is skipped instead
  of 500ing the entire request.

**Dependencies**
- `backend/requirements.txt` was a raw `pip freeze` with two unused packages
  (`requests`, `python-dotenv` — neither imported anywhere in `main.py`) plus
  a pile of transitive deps. Trimmed to the 3 direct dependencies
  (`fastapi`, `pydantic`, `uvicorn`); verified a fresh venv installing only
  those three, with no other packages, boots the real server and serves both
  endpoints correctly via `curl`.
- Added `backend/requirements-dev.txt` (`-r requirements.txt` + `pytest` +
  `httpx`) for running the new test suite — kept separate from prod deps.
- `frontend/package.json` was already accurate/minimal (React + Vite +
  ESLint, nothing unused). Ran `npm audit fix` (non-breaking): resolved 6 of
  8 known vulnerabilities in dev-tooling transitive deps (esbuild, vite,
  postcss, babel, flatted, js-yaml). The remaining 2 (in eslint's
  `minimatch`/`brace-expansion` chain) require a breaking major ESLint
  upgrade (`eslint@10`) via `npm audit fix --force` — left alone since it's a
  dev-only lint dependency, never shipped to users, and I don't make breaking
  dependency jumps without being asked.

**Tests**
- Added `backend/tests/test_main.py` (11 tests, all passing): crag list
  shape, score endpoint happy path, the "Go never coincides with rain"
  invariant (including a direct per-crag sweep), validation rejections
  (bad `max_hours`, bad `style`, out-of-range lat/lon), malformed-weather
  resilience, `days_since_rain` affecting score/last-rain-text, and
  `sun_exposure` affecting score.

## Verified this run
- `GET /api/crags` and `POST /api/score` against the real, unmocked
  `uvicorn main:app` process (not just `TestClient`), via `curl`.
- Full pytest suite green from a **fresh** venv built only from
  `requirements-dev.txt`.
- Frontend: `npm run build` and `npm run lint` both clean.
- Loaded the live Vite dev server in headless Chromium (Playwright) against
  the local backend with `VITE_API_BASE` overridden — confirmed the app
  fetches from the overridden URL (not the hardcoded Render one), the shell
  renders correctly, and the only console errors are the sandbox's outbound
  network block on Nominatim/Open-Meteo (expected here, not present on real
  deploys) plus one **pre-existing, unrelated** issue noted below.

## Known gaps / not done, on purpose
- **Aspect/sun-exposure data only covers the 6 live crags.** If the crag list
  is ever expanded (see the Beacon Rock/Smith Rock/Squamish note above),
  `sun_exposure` defaults to `"medium"` for any crag missing the field — not
  a hard failure, just a neutral assumption flagged here per the task's
  "don't fabricate" instruction.
- **`rock_type` isn't an explicit scoring term.** The task's priority list
  puts rock type at #5, but the existing design already encodes rock
  character through `wet_sensitive` and `overhang` per crag rather than a
  separate rock-type multiplier. Adding a second, overlapping rock-type
  signal on top felt like it would double-count the same physical property
  for little payoff, so I left it as descriptive metadata only (shown in the
  UI, not scored directly) rather than forcing in a redundant term.
- **Pre-existing, unrelated bug spotted but not fixed:** `frontend/index.html`
  registers `/service-worker.js` on load, but that file doesn't exist
  anywhere in the repo (404 in the browser console). This predates tonight's
  changes and is outside the scope I was given — flagging it here rather
  than touching it silently.
- **Could not verify the Open-Meteo `hourly` array-ordering fix against a
  live response** — this sandbox's network policy blocks outbound requests
  to `api.open-meteo.com`. The fix follows Open-Meteo's documented,
  long-stable behavior (hourly arrays are chronological, `current.time`
  marks "now" within them), but a real spot-check after deploy would be
  cheap insurance.
- **No `/health` endpoint added.** Wasn't asked for and Render doesn't
  require one for a `uvicorn` start command, so I left it out rather than
  add an unrequested endpoint.

## Risks taken given full autonomy
- Deleted `backend/crags.json` outright rather than keeping it around
  "just in case" — it's fully superseded (its only non-duplicate data,
  `sun_exposure`, is now in `main.py`) and the task explicitly called it
  dead. Recoverable from git history if a human wants the extra 6 crags
  later.
- Changed the No-Go rain threshold from `rain_now > 0.05` to `rain_now > 0`
  — a small behavior change (very light drizzle now forces No Go instead of
  possibly landing in Maybe). This directly serves the task's explicit ask
  ("Go should never coincide with active rain") and simplifies an asymmetric
  threshold; flagging it as a behavior change since it does shift a few
  borderline cases from "Maybe" to "No Go".
- Trimmed `requirements.txt` to 3 packages instead of leaving the full
  `pip freeze` output. Verified this boots cleanly from a totally fresh venv
  before pushing, but this is still a production dependency change to a
  service with no CI gate in front of it — Render will `pip install` this
  fresh on next deploy.
- Ran `npm audit fix` (non-force) against `frontend/package-lock.json`.
  No `package.json` version ranges changed, only the lockfile's resolved
  versions within those ranges — build and lint both verified green after.

## No new paid services, API keys, or frameworks were introduced.
Everything still runs on the free Open-Meteo and Nominatim APIs, exactly as
before.
