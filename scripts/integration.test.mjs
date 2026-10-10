/**
 * FLOW AI — frontend ↔ backend integration tests.
 *
 * Requires the Flask backend running at VITE_API_BASE_URL
 * (default http://localhost:5000). Exercises every connected endpoint,
 * the adapter's field contracts against real JSON, mutation confirmation
 * (a failed mutation must throw, never look successful), CORS preflight,
 * and the labelled demo fallback. Resets the simulation afterwards.
 *
 * Run: npm run test:integration
 */

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const apiDir = pathToFileURL(resolve(process.cwd(), 'src/api') + '/').href;
const client = await import(apiDir + 'client.js');
const api = await import(apiDir + 'endpoints.js');
const adapter = await import(apiDir + 'adapter.js');

const BASE = client.getApiBaseUrl();
const LEVELS = ['free', 'moderate', 'heavy', 'severe'];
const INCIDENT_UI_STATUSES = ['open', 'acknowledged', 'resolved'];
const MISSION_UI_STATUSES = ['dispatched', 'en-route', 'completed', 'cancelled'];
const MISSION_UI_PRIORITIES = ['critical', 'high', 'medium', 'low'];

let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`ok - ${name}`);
};

async function expectApiError(fn, kind, code) {
  try {
    await fn();
  } catch (err) {
    assert.equal(err.name, 'ApiError', `expected ApiError, got ${err?.name}: ${err?.message}`);
    assert.equal(err.kind, kind, `expected kind=${kind}, got ${err.kind} (${err.message})`);
    if (code !== undefined) assert.equal(err.code, code, `expected code=${code}, got ${err.code}`);
    return err;
  }
  assert.fail(`expected ApiError(${kind}${code ? `/${code}` : ''}) but call succeeded`);
}

function assertKeys(obj, keys, label) {
  for (const key of keys) {
    assert.ok(key in obj, `${label}: missing field "${key}"`);
  }
}

/* ---------------------------------------------- A. reachability + envelope */
const health = await api.getHealth();
assert.equal(health.status, 'healthy');
ok('GET /api/health reachable (envelope unwrapped by client)');

/* ------------------------------------------------- B. adapter field contracts */
const roadsPayload = await api.getRoads();
const uiRoads = adapter.mapRoads(roadsPayload);
assert.ok(uiRoads.length > 0);
for (const road of uiRoads) {
  assertKeys(road, ['id', 'name', 'lat', 'lng', 'congestion', 'speedKph', 'volume', 'note'], 'road');
  assert.ok(LEVELS.includes(road.congestion), `road congestion invalid: ${road.congestion}`);
  assert.equal(typeof road.lat, 'number');
  assert.equal(typeof road.lng, 'number');
  assert.ok(Number.isFinite(road.speedKph) && Number.isFinite(road.volume));
}
ok(`mapRoads: ${uiRoads.length} roads carry every field the map/list renders`);

const incidentsPayload = await api.getIncidents();
const roadNames = adapter.buildRoadNameIndex(roadsPayload);
const clock = health.simulation.clock;
const uiIncidents = adapter.mapIncidents(incidentsPayload, roadNames, clock);
assert.ok(uiIncidents.length > 0);
for (const inc of uiIncidents) {
  assertKeys(inc, ['id', 'title', 'road', 'severity', 'status', 'minutesAgo', 'lanes', 'owner'], 'incident');
  assert.ok(INCIDENT_UI_STATUSES.includes(inc.status), `incident status invalid: ${inc.status}`);
  assert.ok(['critical', 'high', 'medium', 'low'].includes(inc.severity));
  assert.ok(Number.isInteger(inc.minutesAgo) && inc.minutesAgo >= 0);
  assert.ok(inc.title.length > 0 && inc.road.length > 0);
}
assert.equal(
  adapter.mapIncidents(incidentsPayload, roadNames, clock).length,
  (incidentsPayload.incidents ?? []).filter((i) => i.status !== 'dismissed').length,
  'dismissed incidents must not leak into the actionable queue',
);
ok('mapIncidents: fields, enums, road-name resolution and clock arithmetic verified');

const recent = adapter.recentIncidents(uiIncidents);
assert.ok(recent.length <= 5 && recent.length > 0);
ok('recentIncidents: dashboard slice <= 5');

const missionsPayload = await api.getMissions();
const uiMissions = adapter.mapMissions(missionsPayload, roadNames);
assert.ok(uiMissions.length > 0);
for (const m of uiMissions) {
  assertKeys(
    m,
    ['id', 'unit', 'type', 'priority', 'task', 'from', 'to', 'etaMin', 'status', 'progress', 'corridor'],
    'mission',
  );
  assert.ok(MISSION_UI_STATUSES.includes(m.status), `mission status invalid: ${m.status}`);
  assert.ok(MISSION_UI_PRIORITIES.includes(m.priority), `mission priority invalid: ${m.priority}`);
  if (m.status === 'en-route') assert.equal(m.progress, null, 'en-route progress must be null (no backend source)');
  else assert.ok(typeof m.progress === 'number');
}
ok('mapMissions: fields, enums and truthful null progress verified');

const dashboard = await api.getDashboard();
const kpis = adapter.buildDashboardKpis(dashboard);
assert.equal(kpis.length, 6, 'dashboard renders exactly 6 KPI cards');
const seenIds = new Set();
for (const kpi of kpis) {
  assertKeys(kpi, ['id', 'label', 'value', 'unit', 'delta', 'deltaTrend', 'hint', 'icon', 'tone'], 'kpi');
  assert.equal(typeof kpi.value, 'string');
  assert.ok(!seenIds.has(kpi.id), `duplicate kpi id ${kpi.id}`);
  seenIds.add(kpi.id);
}
ok('buildDashboardKpis: 6 cards with every KpiCard field');

const predictionsPayload = await api.getPredictions();
const uiPredictions = adapter.mapPredictions(predictionsPayload);
assert.ok(uiPredictions.length > 0);
for (const p of uiPredictions) {
  assertKeys(p, ['roadId', 'roadName', 'category', 'riskScore', 'trend', 'recommendation'], 'prediction');
  assert.equal(typeof p.riskScore, 'number');
  assert.ok(['smooth', 'moderate', 'congested', 'gridlock'].includes(p.category));
  assert.equal(p.modelTrained, false, 'model_trained must stay false (heuristic)');
}
ok(`mapPredictions: ${uiPredictions.length} rows, model_trained=false preserved`);

assert.equal(adapter.minutesSince('23:50:00', '00:10:00'), 20, 'clock wrap past midnight');
assert.equal(adapter.UI_ACTION_TO_INCIDENT_STATUS.acknowledged, 'in_progress');
ok('adapter pure helpers (clock wrap, action mapping)');

/* ------------------------------------------------------- C. mutation honesty */
const created = await api.createIncident({ road_id: 'road-orr-west', type: 'accident', description: 'integration probe' });
assert.match(created.incident.id, /^inc-/);
assert.equal(created.incident.status, 'active');
ok('POST /api/incidents confirmed by response (created, status=active)');

const acked = await api.updateIncident(created.incident.id, { status: 'in_progress' });
assert.equal(acked.incident.status, 'in_progress');
const resolved = await api.updateIncident(created.incident.id, { status: 'resolved' });
assert.equal(resolved.incident.status, 'resolved');
ok('PATCH /api/incidents: acknowledge + resolve confirmed by response');

await expectApiError(
  () => api.updateIncident(created.incident.id, { status: 'in_progress' }),
  'http',
  'invalid_transition',
);
await expectApiError(() => api.updateIncident(created.incident.id, { status: 'bogus' }), 'http', 'validation_error');
await expectApiError(() => api.updateIncident('inc-0000', { status: 'resolved' }), 'http', 'not_found');
const afterFailures = await api.getIncidents();
const same = afterFailures.incidents.find((i) => i.id === created.incident.id);
assert.equal(same.status, 'resolved', 'failed mutations must leave state unchanged');
ok('failed incident mutations throw + state unchanged (no false success)');

const mission = await api.createMission({
  origin: { lat: 17.3608, lng: 78.5525 },
  destination: { lat: 17.4479, lng: 78.3874 },
  unit_type: 'ambulance',
  priority: 1,
  notes: 'integration probe',
});
assert.equal(mission.mission.status, 'requested');
const cancelled = await api.updateMission(mission.mission.id, { status: 'cancelled' });
assert.equal(cancelled.mission.status, 'cancelled');
await expectApiError(() => api.updateMission(mission.mission.id, { status: 'completed' }), 'http', 'invalid_transition');
await expectApiError(() => api.updateMission('emg-0000', { status: 'cancelled' }), 'http', 'not_found');
ok('POST/PATCH /api/emergency/missions: create, cancel, terminal-lock, 404 confirmed');

const stepped = await api.stepSimulation(1);
assert.equal(stepped.step, 1, 'step confirmed in response');
assert.notEqual(stepped.clock, health.simulation.clock, 'clock advanced');
ok('POST /api/simulation/step confirmed by response (step + clock)');

/* ------------------------------------------------- D. reset restores seeds */
const reset = await api.resetSimulation();
assert.equal(reset.step, 0);
assert.equal(reset.clock, '08:00:00');
const seedIncidents = await api.getIncidents();
const seedMissions = await api.getMissions();
assert.equal(seedIncidents.count, 3, `expected 3 seed incidents, got ${seedIncidents.count}`);
assert.equal(seedMissions.count, 2, `expected 2 seed missions, got ${seedMissions.count}`);
ok('POST /api/simulation/reset confirmed (seeds restored: 3 incidents / 2 missions / step 0)');

/* ------------------------------------------------------------- E. CORS */
const preflight = await fetch(`${BASE}/api/roads`, {
  method: 'OPTIONS',
  headers: {
    Origin: 'http://localhost:5173',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'content-type',
  },
});
assert.ok([200, 204].includes(preflight.status), `preflight status ${preflight.status}`);
assert.equal(
  preflight.headers.get('access-control-allow-origin'),
  'http://localhost:5173',
  'CORS must allow the Vite dev origin',
);
const postPreflight = await fetch(`${BASE}/api/incidents`, {
  method: 'OPTIONS',
  headers: {
    Origin: 'http://localhost:5173',
    'Access-Control-Request-Method': 'PATCH',
    'Access-Control-Request-Headers': 'content-type',
  },
});
assert.equal(
  postPreflight.headers.get('access-control-allow-origin'),
  'http://localhost:5173',
  'CORS must allow PATCH preflight from the Vite dev origin',
);
ok('CORS: GET and PATCH preflights allowed for http://localhost:5173');

/* ------------------------------------------ F. client error paths + fallback */
const realFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error('ECONNREFUSED');
};
await expectApiError(() => api.getRoads(), 'network');
ok('network failure -> ApiError kind=network (page would show labelled demo fallback)');

const failed = await api.loadWithFallback(() => api.getRoads(), [{ id: 'RD-01' }]);
globalThis.fetch = realFetch;
assert.equal(failed.ok, false);
assert.equal(failed.source, 'demo');
assert.match(failed.notice, /Demo data/);
assert.ok(failed.error?.name === 'ApiError');
ok('loadWithFallback failure -> source=demo with explicit Demo-data notice');

console.log(`\nALL ${pass} INTEGRATION CHECKS PASSED`);
