/**
 * FLOW AI — sample dataset.
 *
 * ⚠️ EVERYTHING in this file is SIMULATED sample data used for the hackathon
 * prototype. It is NOT live, NOT connected to sensors, cameras or any backend.
 * Replace this module with real API calls when the backend is ready.
 */

export const SIMULATION = {
  badge: 'SIMULATED',
  notice:
    'All figures, map markers and incidents below are simulated sample data generated for the FLOW AI prototype — they are not live readings.',
  source: 'Simulated feed · demo dataset v1',
};

/* ------------------------------------------------------------------ levels */

export const CONGESTION_LEVELS = [
  { key: 'free', label: 'Free flowing', color: '#22c55e', bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  { key: 'moderate', label: 'Moderate', color: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30' },
  { key: 'heavy', label: 'Heavy', color: '#f97316', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30' },
  { key: 'severe', label: 'Severe', color: '#ef4444', bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30' },
];

export const levelMeta = (key) =>
  CONGESTION_LEVELS.find((l) => l.key === key) ?? CONGESTION_LEVELS[0];

/* -------------------------------------------------------------------- kpis */

export const KPIS = [
  {
    id: 'monitored-roads',
    label: 'Monitored roads',
    value: '42',
    unit: 'corridors',
    delta: '+3 this week',
    deltaTrend: 'up',
    hint: 'Arterials, flyovers & junctions under CCTV/AI watch',
    icon: 'Route',
    tone: 'sky',
  },
  {
    id: 'congested-roads',
    label: 'Congested roads',
    value: '7',
    unit: 'of 42',
    delta: '16.7% of network',
    deltaTrend: 'down',
    hint: 'Heavy or severe congestion right now',
    icon: 'TrafficCone',
    tone: 'orange',
  },
  {
    id: 'incidents',
    label: 'Incidents',
    value: '12',
    unit: 'open',
    delta: '4 high severity',
    deltaTrend: 'flat',
    hint: 'Reported in the last 6 hours',
    icon: 'AlertTriangle',
    tone: 'red',
  },
  {
    id: 'emergency-missions',
    label: 'Emergency missions',
    value: '5',
    unit: 'total',
    delta: '2 active now',
    deltaTrend: 'flat',
    hint: 'Green-corridor missions in progress',
    icon: 'Siren',
    tone: 'violet',
  },
  {
    id: 'avg-travel-time',
    label: 'Avg travel time',
    value: '27',
    unit: 'min / 10 km',
    delta: '−8% vs last hour',
    deltaTrend: 'up',
    hint: 'Network-wide average across monitored corridors',
    icon: 'Clock',
    tone: 'sky',
  },
  {
    id: 'env-savings',
    label: 'Est. environmental savings',
    value: '1.4 t',
    unit: 'CO₂ avoided today',
    delta: '+120 kg since 06:00',
    deltaTrend: 'up',
    hint: 'Estimated from reduced idling (simulated)',
    icon: 'Leaf',
    tone: 'emerald',
  },
];

/* ------------------------------------------------------------ road segments
 * Sample corridors around Bengaluru — coordinates are real, the congestion
 * values attached to them are SIMULATED.
 */

export const ROAD_SEGMENTS = [
  { id: 'RD-01', name: 'MG Road', lat: 12.9756, lng: 77.6068, congestion: 'heavy', speedKph: 18, volume: 1420, note: 'Signal cascade near Cubbon' },
  { id: 'RD-02', name: 'Silk Board Junction', lat: 12.917, lng: 77.6228, congestion: 'severe', speedKph: 9, volume: 2150, note: 'Long queue on Outer Ring Road' },
  { id: 'RD-03', name: 'Hebbal Flyover', lat: 13.0358, lng: 77.597, congestion: 'severe', speedKph: 11, volume: 1980, note: 'Stalled vehicle on ramp' },
  { id: 'RD-04', name: 'Marathahalli Bridge', lat: 12.9569, lng: 77.7011, congestion: 'heavy', speedKph: 15, volume: 1640, note: 'ORR east bound' },
  { id: 'RD-05', name: 'Whitefield / ITPL Main Road', lat: 12.985, lng: 77.736, congestion: 'moderate', speedKph: 26, volume: 1210, note: 'Tech corridor commute' },
  { id: 'RD-06', name: 'Electronic City Flyover', lat: 12.8452, lng: 77.6602, congestion: 'moderate', speedKph: 31, volume: 980, note: 'Flowing at highway speed' },
  { id: 'RD-07', name: 'Majestic / KSR Station', lat: 12.9766, lng: 77.574, congestion: 'heavy', speedKph: 14, volume: 1530, note: 'Bus bay spillover' },
  { id: 'RD-08', name: 'Yeshwanthpur Circle', lat: 13.023, lng: 77.55, congestion: 'moderate', speedKph: 24, volume: 1120, note: 'Truck entry lane busy' },
  { id: 'RD-09', name: 'Jayanagar 4th Block', lat: 12.925, lng: 77.5938, congestion: 'free', speedKph: 42, volume: 640, note: 'Clear in both directions' },
  { id: 'RD-10', name: 'Banashankari BDA Complex', lat: 12.925, lng: 77.546, congestion: 'free', speedKph: 40, volume: 580, note: 'Normal flow' },
];

/* -------------------------------------------------------------- time series */

/** Simulated vehicles-per-hour + average speed across the network (24 h). */
export const TRAFFIC_FLOW_24H = [
  { hour: '00', volume: 320, speed: 54 },
  { hour: '01', volume: 210, speed: 57 },
  { hour: '02', volume: 150, speed: 58 },
  { hour: '03', volume: 130, speed: 59 },
  { hour: '04', volume: 180, speed: 57 },
  { hour: '05', volume: 340, speed: 52 },
  { hour: '06', volume: 620, speed: 46 },
  { hour: '07', volume: 980, speed: 38 },
  { hour: '08', volume: 1450, speed: 26 },
  { hour: '09', volume: 1520, speed: 24 },
  { hour: '10', volume: 1280, speed: 30 },
  { hour: '11', volume: 1150, speed: 33 },
  { hour: '12', volume: 1220, speed: 31 },
  { hour: '13', volume: 1180, speed: 32 },
  { hour: '14', volume: 1100, speed: 34 },
  { hour: '15', volume: 1240, speed: 31 },
  { hour: '16', volume: 1430, speed: 27 },
  { hour: '17', volume: 1680, speed: 22 },
  { hour: '18', volume: 1750, speed: 20 },
  { hour: '19', volume: 1560, speed: 23 },
  { hour: '20', volume: 1180, speed: 30 },
  { hour: '21', volume: 860, speed: 38 },
  { hour: '22', volume: 640, speed: 45 },
  { hour: '23', volume: 430, speed: 51 },
];

/** Simulated congestion index (0–100) per weekday, morning & evening peak. */
export const CONGESTION_TREND_7D = [
  { day: 'Mon', morning: 72, evening: 78 },
  { day: 'Tue', morning: 74, evening: 80 },
  { day: 'Wed', morning: 71, evening: 77 },
  { day: 'Thu', morning: 76, evening: 82 },
  { day: 'Fri', morning: 82, evening: 88 },
  { day: 'Sat', morning: 58, evening: 61 },
  { day: 'Sun', morning: 44, evening: 47 },
];

/** Simulated count of congested roads per 2-hour window. */
export const CONGESTED_ROADS_HOURLY = [
  { hour: '00', roads: 1 },
  { hour: '02', roads: 0 },
  { hour: '04', roads: 1 },
  { hour: '06', roads: 3 },
  { hour: '08', roads: 9 },
  { hour: '10', roads: 6 },
  { hour: '12', roads: 5 },
  { hour: '14', roads: 4 },
  { hour: '16', roads: 7 },
  { hour: '18', roads: 11 },
  { hour: '20', roads: 6 },
  { hour: '22', roads: 3 },
];

/* ---------------------------------------------------------------- incidents */

export const INCIDENTS = [
  {
    id: 'INC-1042',
    title: 'Multi-vehicle collision',
    road: 'NH-44 · Hebbal Flyover',
    severity: 'critical',
    status: 'open',
    minutesAgo: 6,
    lanes: '2 of 3 lanes blocked',
    source: 'CCTV-CAM-17',
    owner: 'Unassigned',
  },
  {
    id: 'INC-1041',
    title: 'Stalled truck on main carriageway',
    road: 'ORR · Silk Board Junction',
    severity: 'critical',
    status: 'acknowledged',
    minutesAgo: 14,
    lanes: '1 lane blocked',
    source: 'CCTV-CAM-04',
    owner: 'Patrol Unit 7',
  },
  {
    id: 'INC-1040',
    title: 'Water logging after burst pipe',
    road: 'Old Airport Road · Marathahalli',
    severity: 'high',
    status: 'acknowledged',
    minutesAgo: 27,
    lanes: 'Shoulder + 1 lane',
    source: 'Citizen app',
    owner: 'BBMP Dispatch',
  },
  {
    id: 'INC-1039',
    title: 'Signal malfunction at junction',
    road: 'Majestic · KSR Station Circle',
    severity: 'high',
    status: 'open',
    minutesAgo: 38,
    lanes: 'All approaches affected',
    source: 'Traffic police',
    owner: 'Unassigned',
  },
  {
    id: 'INC-1038',
    title: 'Two-wheeler skid, minor injuries',
    road: 'SV Road · Jayanagar 4th Block',
    severity: 'medium',
    status: 'resolved',
    minutesAgo: 52,
    lanes: 'Cleared',
    source: 'CCTV-CAM-22',
    owner: 'Patrol Unit 3',
  },
  {
    id: 'INC-1037',
    title: 'Construction debris on service road',
    road: 'ITPL Main Road · Whitefield',
    severity: 'medium',
    status: 'resolved',
    minutesAgo: 74,
    lanes: 'Cleared',
    source: 'Citizen app',
    owner: 'BBMP Dispatch',
  },
  {
    id: 'INC-1036',
    title: 'Bus breakdown at bus bay',
    road: 'Electronic City Flyover',
    severity: 'low',
    status: 'resolved',
    minutesAgo: 96,
    lanes: 'Bus bay only',
    source: 'CCTV-CAM-31',
    owner: 'Patrol Unit 11',
  },
  {
    id: 'INC-1035',
    title: 'Broken-down auto blocking turn lane',
    road: 'Yeshwanthpur Circle',
    severity: 'low',
    status: 'open',
    minutesAgo: 118,
    lanes: '1 turn lane blocked',
    source: 'Citizen app',
    owner: 'Unassigned',
  },
];

/* ------------------------------------------------------------ missions */

export const MISSIONS = [
  {
    id: 'MSN-207',
    unit: 'Medic-12',
    type: 'ambulance',
    priority: 'critical',
    task: 'Cardiac emergency transport',
    from: 'Manipal Hospital, Old Airport Road',
    to: 'CMH Hospital, Jayanagar',
    etaMin: 9,
    status: 'en-route',
    progress: 62,
    corridor: 'Hosur Road → South End Road',
    junctionsCleared: 6,
    junctionsTotal: 9,
  },
  {
    id: 'MSN-206',
    unit: 'Fire-04',
    type: 'fire',
    priority: 'critical',
    task: 'Warehouse fire response',
    from: 'Fire Station 8, Whitefield',
    to: 'ITPL Main Road, Bay 3',
    etaMin: 6,
    status: 'en-route',
    progress: 74,
    corridor: 'ITPL Main Road (green wave)',
    junctionsCleared: 5,
    junctionsTotal: 7,
  },
  {
    id: 'MSN-205',
    unit: 'Patrol-7',
    type: 'police',
    priority: 'high',
    task: 'Accident site securing',
    from: 'Traffic HQ, Indiranagar',
    to: 'Hebbal Flyover',
    etaMin: 3,
    status: 'on-scene',
    progress: 100,
    corridor: 'Outer Ring Road north',
    junctionsCleared: 4,
    junctionsTotal: 4,
  },
  {
    id: 'MSN-204',
    unit: 'Medic-09',
    type: 'ambulance',
    priority: 'high',
    task: 'Inter-hospital patient transfer',
    from: 'St. John\'s Hospital',
    to: 'NIMHANS, Hosur Road',
    etaMin: 12,
    status: 'dispatched',
    progress: 18,
    corridor: 'Hosur Road (awaiting clearance)',
    junctionsCleared: 1,
    junctionsTotal: 8,
  },
  {
    id: 'MSN-203',
    unit: 'Fire-02',
    type: 'fire',
    priority: 'medium',
    task: 'Gas leak inspection (false alarm)',
    from: 'Fire Station 3, Jayanagar',
    to: '4th Block, Jayanagar',
    etaMin: 0,
    status: 'completed',
    progress: 100,
    corridor: 'Completed at 13:42',
    junctionsCleared: 5,
    junctionsTotal: 5,
  },
];

/* ------------------------------------------------------------ environment */

export const ENVIRONMENT = {
  summary: [
    { id: 'co2', label: 'CO₂ avoided (this month)', value: '3.2 t', delta: '+18% vs last month', icon: 'CloudSun', tone: 'emerald' },
    { id: 'fuel', label: 'Fuel saved (this month)', value: '1,450 L', delta: 'Petrol + diesel equivalent', icon: 'Fuel', tone: 'sky' },
    { id: 'idle', label: 'Idling time reduced', value: '12,400 min', delta: '≈ 207 hours of stop-go', icon: 'Timer', tone: 'amber' },
    { id: 'trees', label: 'Tree-equivalent offset', value: '148 trees', delta: 'Based on 21 kg CO₂ / tree / yr', icon: 'TreePine', tone: 'emerald' },
  ],
  /** Weekly CO₂ saved (kg) and litres of fuel saved — simulated. */
  weekly: [
    { week: 'W1', co2: 620, fuel: 275 },
    { week: 'W2', co2: 680, fuel: 302 },
    { week: 'W3', co2: 710, fuel: 316 },
    { week: 'W4', co2: 690, fuel: 307 },
    { week: 'W5', co2: 750, fuel: 334 },
    { week: 'W6', co2: 820, fuel: 365 },
    { week: 'W7', co2: 880, fuel: 391 },
    { week: 'W8', co2: 940, fuel: 418 },
  ],
  /** Hourly idling minutes avoided today — simulated. */
  hourlySavings: [
    { hour: '06', idle: 210, co2: 42 },
    { hour: '08', idle: 640, co2: 128 },
    { hour: '10', idle: 380, co2: 76 },
    { hour: '12', idle: 300, co2: 60 },
    { hour: '14', idle: 260, co2: 52 },
    { hour: '16', idle: 470, co2: 94 },
    { hour: '18', idle: 720, co2: 144 },
    { hour: '20', idle: 350, co2: 70 },
  ],
  breakdown: [
    { label: 'Signal timing optimisation', share: 42, color: '#38bdf8' },
    { label: 'Green corridors for emergency fleets', share: 27, color: '#22c55e' },
    { label: 'Incident fast-clearing', share: 19, color: '#f59e0b' },
    { label: 'Rerouting advisories', share: 12, color: '#a78bfa' },
  ],
};

/** Recent incidents for the dashboard (first 5 open/acknowledged items). */
export const RECENT_INCIDENTS = INCIDENTS.slice(0, 5);

export const severityMeta = (severity) =>
  ({
    critical: { label: 'Critical', chip: 'border-red-500/30 bg-red-500/10 text-red-400', dot: 'bg-red-500' },
    high: { label: 'High', chip: 'border-orange-500/30 bg-orange-500/10 text-orange-400', dot: 'bg-orange-500' },
    medium: { label: 'Medium', chip: 'border-amber-500/30 bg-amber-500/10 text-amber-400', dot: 'bg-amber-400' },
    low: { label: 'Low', chip: 'border-sky-500/30 bg-sky-500/10 text-sky-400', dot: 'bg-sky-400' },
  })[severity] ?? { label: severity, chip: 'border-slate-500/30 bg-slate-500/10 text-slate-400', dot: 'bg-slate-400' };

export const statusMeta = (status) =>
  ({
    open: { label: 'Open', chip: 'border-red-500/30 bg-red-500/10 text-red-400' },
    acknowledged: { label: 'Acknowledged', chip: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
    resolved: { label: 'Resolved', chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
    'en-route': { label: 'En route', chip: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
    dispatched: { label: 'Dispatched', chip: 'border-violet-500/30 bg-violet-500/10 text-violet-400' },
    'on-scene': { label: 'On scene', chip: 'border-orange-500/30 bg-orange-500/10 text-orange-400' },
    completed: { label: 'Completed', chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
    cancelled: { label: 'Cancelled', chip: 'border-slate-500/30 bg-slate-500/10 text-slate-400' },
  })[status] ?? { label: status, chip: 'border-slate-500/30 bg-slate-500/10 text-slate-400' };

export const missionTypeMeta = (type) =>
  ({
    ambulance: { label: 'Ambulance', icon: 'Ambulance' },
    fire: { label: 'Fire', icon: 'Truck' },
    police: { label: 'Police', icon: 'Shield' },
  })[type] ?? { label: type, icon: 'Truck' };

/** Human friendly "x minutes ago" label. */
export const timeAgo = (minutes) => {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min ago` : `${h} h ago`;
};
