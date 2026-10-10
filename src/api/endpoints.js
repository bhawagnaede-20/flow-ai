/**
 * FLOW AI — endpoint helpers for the Flask backend.
 *
 * Conventions (verified against the live API, see INTEGRATION_MAPPING.md):
 * - Every response is `{ ok: true, data, meta }`; apiRequest unwraps `data`.
 * - GET helpers validate the payload shape and throw ApiError on any failure.
 * - Mutations (POST/PATCH) ALWAYS throw on failure — they have no demo
 *   fallback, so a failed backend mutation can never look like a success.
 * - `loadWithFallback` is for READ-ONLY GETs only and labels demo data.
 * - Request field names are the backend's own snake_case names; do not invent
 *   fields — the backend rejects unknown fields with 400 validation_error.
 */

import { apiRequest, expectPayload, ApiError, ERROR_KINDS } from './client.js';

/* --------------------------------------------------------------- read-only */

export function getHealth() {
  return apiRequest('/api/health').then((data) =>
    expectPayload(data, 'GET /api/health', { status: 'string', service: 'string' }),
  );
}

export function getDashboard() {
  return apiRequest('/api/dashboard').then((data) =>
    expectPayload(data, 'GET /api/dashboard', {
      summary: 'object',
      incidents: 'object',
      emergency: 'object',
      congestion_breakdown: 'object',
    }),
  );
}

export function getRoads() {
  return apiRequest('/api/roads').then((data) =>
    expectPayload(data, 'GET /api/roads', { roads: 'array', count: 'number' }),
  );
}

export function getIncidents() {
  return apiRequest('/api/incidents').then((data) =>
    expectPayload(data, 'GET /api/incidents', { incidents: 'array', count: 'number' }),
  );
}

export function getPredictions() {
  return apiRequest('/api/predictions').then((data) =>
    expectPayload(data, 'GET /api/predictions', {
      predictions: 'array',
      count: 'number',
      model_trained: 'boolean',
      horizon_minutes: 'number',
    }),
  );
}

export function getMissions() {
  return apiRequest('/api/emergency/missions').then((data) =>
    expectPayload(data, 'GET /api/emergency/missions', { missions: 'array', count: 'number' }),
  );
}

export function getImpact() {
  return apiRequest('/api/impact').then((data) =>
    expectPayload(data, 'GET /api/impact', {
      network: 'object',
      missions: 'object',
      assumptions: 'array',
    }),
  );
}

/* ------------------------------------------------- read-only POST compute */

/**
 * Single-road prediction.
 * @param {{ road_id: string, minutes_ahead?: number }} body
 * @returns {Promise<object>} data containing `prediction`
 */
export function predict(body) {
  return apiRequest('/api/predict', { method: 'POST', body }).then((data) =>
    expectPayload(data, 'POST /api/predict', { prediction: 'object' }),
  );
}

/**
 * Dijkstra route over the simulated network.
 * @param {{ origin: {lat:number,lng:number}, destination: {lat:number,lng:number}, priority?: number }} body
 * @returns {Promise<object>} data containing `route`
 */
export function calculateRoute(body) {
  return apiRequest('/api/routes', { method: 'POST', body }).then((data) =>
    expectPayload(data, 'POST /api/routes', { route: 'object' }),
  );
}

/* ------------------------------------------------------------- mutations */

/**
 * Create an incident — e.g. { road_id, type, severity?, description? }.
 * @returns {Promise<object>} the created `incident`
 */
export function createIncident(body) {
  return apiRequest('/api/incidents', { method: 'POST', body }).then((data) =>
    expectPayload(data, 'POST /api/incidents', { incident: 'object' }),
  );
}

/**
 * Update an incident — e.g. { status: 'in_progress' | 'resolved' | 'dismissed' | 'active',
 * severity?, description? }. Invalid transitions -> ApiError(409 invalid_transition).
 * @param {string} incidentId e.g. "inc-0001"
 * @returns {Promise<object>} the updated `incident`
 */
export function updateIncident(incidentId, body) {
  return apiRequest(`/api/incidents/${encodeURIComponent(incidentId)}`, {
    method: 'PATCH',
    body,
  }).then((data) =>
    expectPayload(data, `PATCH /api/incidents/${incidentId}`, { incident: 'object' }),
  );
}

/**
 * Create an emergency mission — e.g.
 * { origin: {lat,lng}, destination: {lat,lng}, unit_type, priority?, notes? }.
 * @returns {Promise<object>} the created `mission` (includes computed `route`)
 */
export function createMission(body) {
  return apiRequest('/api/emergency/missions', { method: 'POST', body }).then((data) =>
    expectPayload(data, 'POST /api/emergency/missions', { mission: 'object' }),
  );
}

/**
 * Update a mission — e.g. { status: 'enroute' | 'completed' | 'cancelled' | 'requested' }.
 * @param {string} missionId e.g. "emg-0001"
 * @returns {Promise<object>} the updated `mission`
 */
export function updateMission(missionId, body) {
  return apiRequest(`/api/emergency/missions/${encodeURIComponent(missionId)}`, {
    method: 'PATCH',
    body,
  }).then((data) =>
    expectPayload(data, `PATCH /api/emergency/missions/${missionId}`, { mission: 'object' }),
  );
}

/**
 * Advance the simulation.
 * @param {number} [steps] 1–12
 * @returns {Promise<object>} { step, steps_applied, clock, count, roads }
 */
export function stepSimulation(steps = 1) {
  return apiRequest('/api/simulation/step', { method: 'POST', body: { steps } }).then((data) =>
    expectPayload(data, 'POST /api/simulation/step', {
      step: 'number',
      clock: 'string',
      roads: 'array',
    }),
  );
}

/**
 * Reset the simulation to its deterministic seed state.
 * @returns {Promise<object>} { step: 0, clock, message, count, roads }
 */
export function resetSimulation() {
  return apiRequest('/api/simulation/reset', { method: 'POST', body: {} }).then((data) =>
    expectPayload(data, 'POST /api/simulation/reset', {
      step: 'number',
      clock: 'string',
      roads: 'array',
    }),
  );
}

/* ------------------------------------------------------- demo fallback */

export const DEMO_FALLBACK_NOTICE =
  'Demo data — the backend could not be reached, so this view is showing the built-in ' +
  'sample dataset instead. These values are NOT from the backend.';

/**
 * READ-ONLY helper that preserves the demo-data fallback and labels it.
 *
 * On success: { ok: true,  source: 'backend', data, error: null }
 * On failure: { ok: false, source: 'demo',    data: fallbackData, error, notice }
 *
 * Never pass a mutation to this function — mutations must surface their error.
 *
 * @template T
 * @param {() => Promise<T>} fetcher   one of the GET helpers above
 * @param {T} fallbackData             demo dataset (from src/data/simulatedData.js)
 */
export async function loadWithFallback(fetcher, fallbackData) {
  try {
    const data = await fetcher();
    return { ok: true, source: 'backend', data, error: null, notice: null, simulated: true };
  } catch (error) {
    return {
      ok: false,
      source: 'demo',
      data: fallbackData,
      error: error instanceof ApiError ? error : new ApiError(String(error), { kind: ERROR_KINDS.NETWORK }),
      notice: DEMO_FALLBACK_NOTICE,
      simulated: true,
    };
  }
}
