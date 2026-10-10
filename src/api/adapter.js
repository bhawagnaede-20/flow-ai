/**
 * FLOW AI — adapter: backend JSON → the exact shapes the existing UI renders.
 *
 * Every mapping below is documented in INTEGRATION_MAPPING.md (§3 live backend
 * fields, §4 field-by-field mapping). No backend field is invented; where the
 * backend has no source for a UI field the adapter either derives it from real
 * data (midpoint, road-name lookup, clock arithmetic) or returns `null` so the
 * component can hide the stat instead of fabricating a number.
 *
 * Pure module (no React, no fetch) — usable from node for integration tests.
 */

/* ------------------------------------------------------------- constants */

/** Backend road status -> frontend congestion level key. */
export const ROAD_STATUS_TO_LEVEL = {
  smooth: 'free',
  moderate: 'moderate',
  congested: 'heavy',
  gridlock: 'severe',
};

/** Backend incident status -> frontend status key. */
export const INCIDENT_STATUS_TO_UI = {
  active: 'open',
  in_progress: 'acknowledged',
  resolved: 'resolved',
  // 'dismissed' is filtered out of the queue (not an actionable state in the UI).
};

/** Frontend action -> backend PATCH status (Acknowledge / Resolve buttons). */
export const UI_ACTION_TO_INCIDENT_STATUS = {
  acknowledged: 'in_progress',
  resolved: 'resolved',
};

/** Backend mission status -> frontend status key. */
export const MISSION_STATUS_TO_UI = {
  requested: 'dispatched',
  enroute: 'en-route',
  completed: 'completed',
  cancelled: 'cancelled',
};

/** Backend incident type -> neutral title when description is empty. */
export const INCIDENT_TYPE_TITLES = {
  accident: 'Accident reported',
  breakdown: 'Vehicle breakdown',
  construction: 'Road works',
  flooding: 'Water logging',
  police_activity: 'Police activity',
  signal_failure: 'Signal malfunction',
};

/** Backend priority (1 highest … 5 lowest) -> frontend priority chip key. */
export const PRIORITY_TO_UI = { 1: 'critical', 2: 'high', 3: 'medium', 4: 'low', 5: 'low' };

/**
 * Progress bar: truthful values only (0 = not started, 100 = closed).
 * 'enroute' returns null — the backend has no progress field, so the UI
 * hides the bar rather than invent a percentage.
 */
export const PROGRESS_BY_STATUS = {
  requested: 0,
  enroute: null,
  completed: 100,
  cancelled: 100,
};

/* ------------------------------------------------------------- helpers */

const toMinutes = (hhmmss) => {
  const [h, m] = String(hhmmss ?? '0:0').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

/** Whole minutes between a reported_at clock string and the current sim clock. */
export function minutesSince(reportedAt, clock) {
  const a = toMinutes(reportedAt);
  const b = toMinutes(clock);
  if (a === null || b === null) return 0;
  let delta = b - a;
  if (delta < 0) delta += 24 * 60; // clock wraps past midnight
  return delta;
}

/** road_id -> road name lookup built from a GET /api/roads payload. */
export function buildRoadNameIndex(roadsPayload) {
  const index = new Map();
  for (const road of roadsPayload?.roads ?? []) index.set(road.id, road.name);
  return index;
}

/* ------------------------------------------------------------- mappers */

/**
 * GET /api/roads → ROAD_SEGMENTS shape.
 * Marker point = midpoint of the road's real from/to endpoints.
 */
export function mapRoads(roadsPayload) {
  return (roadsPayload?.roads ?? []).map((road) => ({
    id: road.id,
    name: road.name,
    lat: (road.from.lat + road.to.lat) / 2,
    lng: (road.from.lng + road.to.lng) / 2,
    congestion: ROAD_STATUS_TO_LEVEL[road.status] ?? 'moderate',
    speedKph: Math.round(road.avg_speed_kmh),
    volume: road.vehicle_count,
    note: `${road.from.name} → ${road.to.name}`,
    // extra real context for list rows (unused keys are harmless)
    category: road.category,
    lengthKm: road.length_km,
    backendStatus: road.status,
  }));
}

/**
 * GET /api/incidents (+ road-name index + sim clock) → INCIDENTS shape.
 * Dismissed incidents are excluded (no matching UI state).
 */
export function mapIncidents(incidentsPayload, roadNames, clock) {
  const rows = [];
  for (const incident of incidentsPayload?.incidents ?? []) {
    const uiStatus = INCIDENT_STATUS_TO_UI[incident.status];
    if (!uiStatus) continue; // dismissed
    rows.push({
      id: incident.id,
      title: incident.description || INCIDENT_TYPE_TITLES[incident.type] || incident.type,
      road: roadNames.get(incident.road_id) ?? incident.road_id,
      severity: incident.severity,
      status: uiStatus,
      minutesAgo: minutesSince(incident.reported_at, clock),
      lanes: '', // backend has no lane data — row renders nothing here
      owner: '', // backend has no owner data
      type: incident.type,
      roadId: incident.road_id,
      reportedAt: incident.reported_at,
    });
  }
  rows.sort((a, b) => a.minutesAgo - b.minutesAgo);
  return rows;
}

/** Dashboard "recent incidents": newest first, first 5 (matches demo slice). */
export function recentIncidents(uiIncidents) {
  return uiIncidents.slice(0, 5);
}

/**
 * GET /api/emergency/missions (+ road names) → MISSIONS shape.
 * junctionsCleared/Total and (for enroute) progress are null: no backend source.
 */
export function mapMissions(missionsPayload, roadNames) {
  return (missionsPayload?.missions ?? []).map((mission) => {
    const route = mission.route ?? {};
    const corridorRoads = (route.road_ids ?? [])
      .map((id) => roadNames.get(id))
      .filter(Boolean);
    return {
      id: mission.id,
      unit: mission.unit_type,
      type: mission.unit_type,
      priority: PRIORITY_TO_UI[mission.priority] ?? 'medium',
      task: mission.notes || 'Emergency response mission',
      from: route.origin_junction ?? `${mission.origin?.lat}, ${mission.origin?.lng}`,
      to: route.destination_junction ?? `${mission.destination?.lat}, ${mission.destination?.lng}`,
      etaMin:
        mission.status === 'completed' || mission.status === 'cancelled'
          ? 0
          : Math.max(1, Math.round(route.travel_time_min ?? 0)),
      status: MISSION_STATUS_TO_UI[mission.status] ?? mission.status,
      progress: PROGRESS_BY_STATUS[mission.status] ?? null,
      corridor:
        corridorRoads.length > 0
          ? corridorRoads.join(' → ')
          : `${route.origin_junction ?? 'Origin'} → ${route.destination_junction ?? 'destination'}`,
      junctionsCleared: null,
      junctionsTotal: null,
      routeDisclaimer: route.disclaimer ?? null,
      routeTravelTimeMin: route.travel_time_min ?? null,
      priorityTimeSavedMin: route.priority_time_saved_min ?? 0,
    };
  });
}

/** GET /api/predictions → rows for the dashboard prediction panel. */
export function mapPredictions(predictionsPayload) {
  return (predictionsPayload?.predictions ?? []).map((p) => ({
    roadId: p.road_id,
    roadName: p.road_name,
    category: p.category,
    currentCongestion: p.current_congestion,
    predictedCongestion: p.predicted_congestion,
    deltaCongestion: p.delta_congestion,
    riskScore: p.risk_score,
    trend: p.trend,
    recommendation: p.recommendation,
    horizonMinutes: p.horizon_minutes,
    modelTrained: predictionsPayload?.model_trained ?? false,
    method: predictionsPayload?.method ?? p.method,
  }));
}

/**
 * GET /api/dashboard → the six KPI cards the dashboard renders.
 * All values derive from real summary fields; no trend history exists in the
 * backend, so deltaTrend is always 'flat' (neutral colour, no invented trend).
 */
export function buildDashboardKpis(dashboard) {
  const s = dashboard?.summary ?? {};
  const incidents = dashboard?.incidents ?? {};
  const emergency = dashboard?.emergency ?? {};
  const breakdown = dashboard?.congestion_breakdown ?? {};
  const roads = s.roads_monitored ?? 0;
  const avgSpeed = s.avg_speed_kmh ?? 0;
  const congested = (breakdown.congested ?? 0) + (breakdown.gridlock ?? 0);
  const congestedPct = roads > 0 ? ((congested / roads) * 100).toFixed(1) : '0.0';
  const highSev = (incidents.by_severity?.high ?? 0) + (incidents.by_severity?.critical ?? 0);
  const travel10k = avgSpeed > 0 ? Math.round((10 / avgSpeed) * 60) : null;

  return [
    {
      id: 'monitored-roads',
      label: 'Monitored roads',
      value: String(roads),
      unit: 'corridors',
      delta: `${s.avg_congestion ?? 0}% avg congestion`,
      deltaTrend: 'flat',
      hint: 'Simulated road network under observation',
      icon: 'Route',
      tone: 'sky',
    },
    {
      id: 'congested-roads',
      label: 'Congested roads',
      value: String(congested),
      unit: `of ${roads}`,
      delta: `${congestedPct}% of network`,
      deltaTrend: 'flat',
      hint: 'Heavy or severe congestion right now (simulated)',
      icon: 'TrafficCone',
      tone: 'orange',
    },
    {
      id: 'incidents',
      label: 'Incidents',
      value: String(s.active_incidents ?? 0),
      unit: 'open',
      delta: `${highSev} high severity`,
      deltaTrend: 'flat',
      hint: 'Active or in-progress in the simulated queue',
      icon: 'AlertTriangle',
      tone: 'red',
    },
    {
      id: 'emergency-missions',
      label: 'Emergency missions',
      value: String(emergency.active ?? 0),
      unit: 'active',
      delta: `${emergency.total ?? 0} total`,
      deltaTrend: 'flat',
      hint: 'Simulated green-corridor missions (no real dispatch)',
      icon: 'Siren',
      tone: 'violet',
    },
    {
      id: 'avg-travel-time',
      label: 'Avg travel time',
      value: travel10k === null ? '—' : String(travel10k),
      unit: 'min / 10 km',
      delta: `${avgSpeed} km/h network avg`,
      deltaTrend: 'flat',
      hint: 'Derived from simulated average speed',
      icon: 'Clock',
      tone: 'sky',
    },
    {
      id: 'vehicles-observed',
      label: 'Vehicles observed',
      value: String(s.vehicles_observed ?? 0),
      unit: 'vehicles',
      delta: 'Simulated occupancy now',
      deltaTrend: 'flat',
      hint: 'Sum of simulated vehicle counts across roads',
      icon: 'CloudSun',
      tone: 'emerald',
    },
  ];
}
