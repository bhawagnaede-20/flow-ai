# FLOW AI — Backend (simulated smart traffic management)

A small, reliable Flask API that serves **synthetic, in-memory simulated data**
for a geographically coherent road network around **Hyderabad, India**.
Every value returned by this API is simulated and labelled as such
(`meta.simulated: true` on every response). No external database, no trained
model yet — the goal is a dependable API contract first.

> ⚠️ All values are simulated. Do not use this for real-world navigation or
> emergency response.

## Stack

- Python 3.12+
- Flask, flask-cors (environment-based restrictive CORS)
- waitress (production WSGI server)
- pytest for the test suite
- scikit-learn is intentionally **not** installed yet; predictions use a
  deterministic heuristic until a real model is introduced

## Setup

```bash
python -m venv backend/.venv

# Windows
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
# macOS / Linux
backend/.venv/bin/pip install -r backend/requirements.txt
```

## Run the server (port 5000)

```bash
python backend/app.py
# or explicitly
FLOW_AI_HOST=127.0.0.1 FLOW_AI_PORT=5000 python backend/app.py
```

## Run the tests

```bash
python -m pytest backend/tests -v
# or from backend/
python -m pytest tests -v
```

Every test starts from the deterministic initial dataset (see
`tests/conftest.py`), so runs are repeatable.

## Project layout

```
backend/
├── app.py              # Flask app: routes, in-memory state, simulation logic
├── requirements.txt    # Flask, flask-cors, pytest
├── README.md
└── tests/
    ├── conftest.py     # test client fixture (resets state per test)
    └── test_api.py     # health, CORS, endpoint, validation, simulation tests
```

## Response format (consistent envelope)

Success — HTTP `200` / `201`:

```json
{
  "ok": true,
  "data": { "…": "endpoint-specific payload" },
  "meta": {
    "simulated": true,
    "api_version": "1.0",
    "notice": "All values returned by this API are simulated…"
  }
}
```

Error — HTTP `400` / `404` / `405` / `500`:

```json
{
  "ok": false,
  "error": { "code": "validation_error", "message": "severity must be one of: …" },
  "meta": { "simulated": true, "api_version": "1.0", "notice": "…" }
}
```

Error codes: `invalid_json`, `validation_error`, `invalid_transition`,
`not_found`, `method_not_allowed`, `bad_request`, `conflict`,
`internal_error`.

## Status codes

| Code | Meaning |
| ---- | ------- |
| 200  | Success (GET/PATCH, simulation step/reset) |
| 201  | Resource created (POST incident/mission) |
| 400  | Invalid/missing JSON body or failed validation (including unknown `road_id` on create) |
| 404  | Unknown resource id or unknown route |
| 405  | Method not allowed on an existing route |
| 409  | Invalid status transition (e.g. resolved incident directly to `in_progress`) |
| 500  | Unexpected server error |

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET  | `/api/health` | Service health, simulation clock/step |
| GET  | `/api/dashboard` | Aggregates computed **from the same in-memory road/incident/mission data** |
| GET  | `/api/roads` | All roads with simulated traffic values |
| GET  | `/api/incidents` | List incidents |
| POST | `/api/incidents` | Create incident (`road_id`, `type` required; `severity`, `status`, `description`, `location` optional) |
| PATCH | `/api/incidents/<incident_id>` | Update `status` / `severity` / `description` |
| GET  | `/api/predictions` | Heuristic predictions for every road (`?horizon_minutes=5..120`, default 30) |
| POST | `/api/predict` | Predict one road (`road_id` required, `minutes_ahead` optional 5..120; no other fields allowed) |
| POST | `/api/routes` | Dijkstra route between two points or two roads (`origin`, `destination` each `{"lat","lng"}` or `{"road_id"}`, `priority` optional 1–5) |
| GET  | `/api/emergency/missions` | List emergency missions (each includes a freshly computed `route`) |
| POST | `/api/emergency/missions` | Create mission (`unit_type`, `origin`, `destination` required; `priority` 1–5, `notes` optional) |
| PATCH | `/api/emergency/missions/<mission_id>` | Update `status` / `priority` / `notes` (priority change re-routes) |
| GET  | `/api/impact` | Illustrative simulated time/fuel/emissions estimates with assumptions |
| POST | `/api/simulation/step` | Advance the simulation (`steps` optional, 1–12, default 1) |
| POST | `/api/simulation/reset` | Restore deterministic initial data |

### Enumerations

- **Road categories:** `highway`, `arterial`, `collector`
- **Road status (derived from congestion):** `smooth` (<40), `moderate` (<65),
  `congested` (<85), `gridlock` (≥85)
- **Incident types:** `accident`, `breakdown`, `construction`, `flooding`,
  `signal_failure`, `police_activity`
- **Incident severities:** `low`, `medium`, `high`, `critical`
- **Incident statuses:** `active`, `in_progress`, `resolved`, `dismissed`
- **Mission unit types:** `ambulance`, `fire`, `police`
- **Mission statuses:** `requested`, `enroute`, `completed`, `cancelled`

### Status transitions (enforced, HTTP 409 `invalid_transition` otherwise)

- Incidents: `active` → (`in_progress` | `resolved` | `dismissed`);
  `in_progress` → (`resolved` | `dismissed`); `resolved` / `dismissed` →
  `active` (reopen). Resolving or dismissing straight from the other closed
  state requires reopening first. Updates are atomic: a rejected body changes
  nothing.
- Missions: `requested` → (`enroute` | `completed` | `cancelled`);
  `enroute` → (`completed` | `cancelled`); `completed` and `cancelled` are
  terminal.

### Counts used by the dashboard

- `active_incidents` = incidents with status `active` or `in_progress`
- `incidents.dismissed` = incidents with status `dismissed`
- `active_missions` = missions with status `requested` or `enroute`

## Stable IDs

- Roads: fixed slugs, e.g. `road-nehru-marg`, `road-orr-west`, `road-hitec-city`
  (12 roads around Hyderabad: ORR segments, HITEC City, Gachibowli–Miyapur,
  Nehru Marg, Banjara Hills, Necklace Road, SD Road, Charminar–Mehdipatnam,
  Uppal–Nagole, KPHB–Kukatpally, Srisailam Highway)
- Incidents: `inc-0001`, `inc-0002`, … sequential, assigned on creation
- Missions: `emg-0001`, `emg-0002`, … sequential, assigned on creation

## Routing (Dijkstra, simulated)

`POST /api/routes` and every mission payload run Dijkstra over a graph built
from the seed roads' named junctions:

- **Edges** are the 12 modelled roads plus straight-line **`corridor_link`**
  segments joining junctions up to 9 km apart. Links are a documented
  simulation simplification for network connectivity - they are labelled
  `type: "corridor_link"` and are never presented as modelled roads.
- **Edge travel time** = distance / speed, where road speed is
  `free_flow_speed x (1 - 0.75 x congestion/100)` (floor 8 km/h, the same
  formula as `avg_speed_kmh`), and corridor links run at 30 km/h scaled by the
  network-average congestion.
- **Edge cost** = travel time x `(1 + congestion aversion x congestion/100)`,
  with `aversion = (5 - priority) x 0.20`. Priority 1 (highest urgency) is the
  most congestion-averse, so **priority can change the selected path**; it also
  gets a **simulated intersection-priority saving** of 12/9/6/3/0% for
  priorities 1-5 (reported as `priority_time_saved_min`).
- Routes report `road_ids`, per-segment detail, `distance_km`,
  `free_flow_time_min`, `raw_travel_time_min`, `travel_time_min` (after the
  priority saving), `cost`, time-weighted `congestion_exposure`,
  `simulated_intersection_priority` and illustrative `estimates`.
- Routes are recomputed from live simulation state on every read, so they
  change when `/api/simulation/step` changes congestion.
- **Disclaimer (returned on every route): no real ambulance dispatch and no
  real traffic-signal control is performed.**

## Predictions (heuristic, no trained model)

Both prediction endpoints return the **identical** prediction object per road:
`category` / `predicted_status` (smooth | moderate | congested | gridlock),
`risk_score` (0-100), `trend` (rising | falling | stable), `delta_congestion`,
`factors` (current congestion, deterministic demand wave, incident pressure),
a `recommendation` (clearly labelled *simulated advisory*), `confidence`, and
`method: deterministic_heuristic` with `model_trained: false`. Malformed JSON,
missing/unknown `road_id`, out-of-range horizons and unknown fields are all
rejected with 400/404.

## Environmental impact (illustrative only)

`GET /api/impact` derives estimates **only from data the API actually has**
(road length, free-flow speed, simulated congestion, simulated vehicle counts,
computed mission routes):

- Network: `delay_vehicle_hours` (actual vs free-flow traversal per vehicle),
  `fuel_liters`, `co2_kg`, plus a per-road breakdown.
- Missions: per-route `delay_min`, `excess_fuel_l`, `excess_co2_kg` for a
  single simulated vehicle.
- Assumptions are returned in the response (`assumptions`): 7.0 L/100km
  free-flow petrol baseline, up to +50% L/100km at full congestion, 0.9 L per
  delayed vehicle-hour, 2.31 kg CO2 per litre, corridor links at 30 km/h.
- Results are labelled **simulated illustrative estimates, not measured data
  and not measured savings**.

## Simulation semantics

- All state lives in memory (`STATE` in `app.py`); a restart re-seeds it.
- One step = 5 simulated minutes; the clock starts at `08:00:00` and the step
  counter starts at `0`.
- Each step moves every road's congestion toward a deterministic target
  (`initial congestion + sinusoidal demand wave + unresolved-incident pressure`),
  so **traffic values change on every step** while remaining reproducible.
- Derived values (`status`, `avg_speed_kmh`, `vehicle_count`) are pure
  functions of congestion, keeping endpoints mutually consistent.
- `/api/simulation/reset` restores the exact seed dataset (roads, incidents,
  missions, counters, clock) — verified by tests, including after multiple
  steps and created records.
- Predictions reuse the same deterministic wave/pressure math with
  `model_trained: false`; no sklearn model is fitted yet.

## Environment variables (placeholders only — see `backend/.env.example`)

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `FLOW_AI_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated exact origins allowed by CORS. Set this in production to your real frontend origin(s). Non-http(s) values crash at startup (fail fast) instead of silently weakening CORS. |
| `FLOW_AI_HOST` | `127.0.0.1` | Bind address for `python backend/app.py`. Set `0.0.0.0` only when the platform requires external binding. |
| `FLOW_AI_PORT` | `5000` | Port for `python backend/app.py`; takes precedence over `PORT`. |
| `PORT` | *(unset)* | Standard port injected by hosting platforms; used when `FLOW_AI_ALLOWED_ORIGINS`-sibling `FLOW_AI_PORT` is unset. |

This service has **no secrets of its own**. Never commit a real `.env` file or
credentials — `.env` is gitignored; only the placeholder-only `.env.example`
is tracked.

## CORS (restrictive, environment-based)

Only the exact origins in `FLOW_AI_ALLOWED_ORIGINS` receive CORS grants, for
`GET`, `POST`, `PATCH`, `OPTIONS` on `/api/*`.

- **Local development (default):** the Vite dev server on
  `http://localhost:5173` / `http://127.0.0.1:5173`.
- **Production:** set `FLOW_AI_ALLOWED_ORIGINS=https://your-frontend.example.com`
  (comma-separate multiple origins). Other origins receive the JSON response
  but **no** `Access-Control-Allow-Origin` header, so browsers block them.
- A malformed value (e.g. a bare domain) raises `ValueError` at startup.

## Health check

`GET /api/health` returns HTTP 200 with the simulation clock/step and is a
suitable platform health/readiness probe:

```json
{
  "ok": true,
  "data": {
    "status": "healthy",
    "service": "flow-ai-backend",
    "api_version": "1.0",
    "simulation": { "step": 0, "clock": "08:00:00", "running": true },
    "notice": "All values returned by this API are simulated…"
  },
  "meta": { "simulated": true, "api_version": "1.0", "notice": "…" }
}
```

## Production deployment (WSGI via waitress)

`waitress` is included in `requirements.txt` as the production WSGI server
(multi-threaded, pure Python, no native dependencies). From the repository
root:

```bash
pip install -r backend/requirements.txt
waitress-serve --host=0.0.0.0 --port="${PORT:-5000}" backend.app:app
```

Or, equivalently, from `backend/` (module:app form used and verified locally):

```bash
cd backend
FLOW_AI_ALLOWED_ORIGINS=https://your-frontend.example.com waitress-serve --host=0.0.0.0 --port=${PORT:-5000} app:app
```

Generic platform steps (Render / Railway / Fly / Heroku-style):

1. **Build command:** `pip install -r backend/requirements.txt`
2. **Start command:** `waitress-serve --host=0.0.0.0 --port=$PORT backend.app:app` (run from the repository root)
3. **Health check path:** `GET /api/health`
4. **Environment:** set `FLOW_AI_ALLOWED_ORIGINS` to your deployed frontend
   origin. `PORT` is injected by the platform automatically.
5. `python backend/app.py` remains a safe local fallback (binds
   `127.0.0.1:5000` by default).

> ⚠️ **State is in-memory and resets on every restart.** Roads, incidents,
> missions and the simulation clock live in the `STATE` dict inside `app.py`.
> There is no database and no persistence; a redeploy or crash wipes all
> created records back to the deterministic seed dataset.

> ⚠️ **All traffic/emergency features are simulated.** Predictions are a
> deterministic heuristic (`model_trained: false`), routing is Dijkstra over a
> synthetic network, and no real ambulance dispatch or traffic-signal control
> is performed. Do not present this as a real traffic-control system.

### Frontend integration quick-start

```bash
# terminal 1 — API on :5000
cd backend && python app.py

# terminal 2 — Vite on :5173 (default CORS already allows it)
npm run dev
```

Point the frontend at the API with `VITE_API_BASE_URL=http://localhost:5000`
(see the repo-root `.env.example`). The frontend's
`npm run test:integration` script exercises these endpoints.

## Frontend ownership

This directory is backend-owned only. Frontend source, `package.json`, and
frontend configuration were not touched.
