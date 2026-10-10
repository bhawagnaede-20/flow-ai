import {
  AlertTriangle,
  Activity,
  ArrowRight,
  Gauge,
  Map as MapIcon,
  Siren,
  TrendingUp,
} from 'lucide-react';
import { Panel, SectionHeading, Button } from '../components/ui/Panel.jsx';
import KpiCard, { KpiCardSkeleton } from '../components/ui/KpiCard.jsx';
import { SimulatedNotice } from '../components/ui/SimulatedBadge.jsx';
import {
  ChartLoadingState,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui/StateViews.jsx';
import { CongestionTrendChart, TrafficFlowChart, CongestionDistributionChart } from '../components/charts/TrafficCharts.jsx';
import IncidentList from '../components/incidents/IncidentList.jsx';
import { useSimulatedResource } from '../hooks/useSimulatedResource.js';
import { useApiResource } from '../api/useApiResource.js';
import { getDashboard, getHealth, getIncidents, getPredictions, getRoads } from '../api/endpoints.js';
import {
  buildDashboardKpis,
  buildRoadNameIndex,
  mapIncidents,
  mapPredictions,
  mapRoads,
  recentIncidents,
} from '../api/adapter.js';
import { ApiFallbackNotice } from '../components/ui/SimulatedBadge.jsx';
import PredictionPanel from '../components/predictions/PredictionPanel.jsx';
import SimulationControls from '../components/ui/SimulationControls.jsx';
import {
  CONGESTED_ROADS_HOURLY,
  KPIS,
  RECENT_INCIDENTS,
  ROAD_SEGMENTS,
  SIMULATION,
  levelMeta,
} from '../data/simulatedData.js';

export default function DashboardPage({ onNavigate }) {
  const kpis = useApiResource(() => getDashboard().then(buildDashboardKpis), { fallback: KPIS });
  const charts = useSimulatedResource(() => ({ flow: true })); // demo-only series: no backend source
  const incidents = useApiResource(
    () =>
      Promise.all([getIncidents(), getRoads(), getHealth()]).then(([inc, roads, health]) =>
        recentIncidents(mapIncidents(inc, buildRoadNameIndex(roads), health?.simulation?.clock)),
      ),
    { fallback: RECENT_INCIDENTS },
  );
  // Predictions have no demo dataset: if the backend is down, this panel shows
  // its error state rather than fabricated rows.
  const predictions = useApiResource(() => getPredictions().then(mapPredictions));
  const roadsRes = useApiResource(() => getRoads().then(mapRoads), { fallback: ROAD_SEGMENTS });
  const health = useApiResource(getHealth); // simulation clock/step for the controls

  const congested = (roadsRes.data ?? [])
    .filter((r) => r.congestion === 'heavy' || r.congestion === 'severe')
    .sort((a, b) => a.speedKph - b.speedKph);

  // Called only after /api/simulation/* confirms; refreshes every live panel.
  const onSimAdvanced = () => {
    kpis.retry();
    incidents.retry();
    predictions.retry();
    roadsRes.retry();
    health.retry();
  };

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Network overview"
        description="Real-time style overview of the simulated FLOW AI control room."
        actions={
          <>
            <Button onClick={() => onNavigate('map')}>
              <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Open map
            </Button>
            <Button variant="primary" onClick={() => onNavigate('missions')}>
              <Siren className="h-3.5 w-3.5" aria-hidden="true" />
              Active missions
            </Button>
            <SimulationControls
              clock={health.data?.simulation?.clock}
              step={health.data?.simulation?.step}
              enabled={health.status === 'ready'}
              onAdvanced={onSimAdvanced}
            />
          </>
        }
      />

      <SimulatedNotice />
      <ApiFallbackNotice resources={[kpis, incidents, roadsRes]} />

      {/* KPI cards */}
      {kpis.status === 'loading' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : kpis.status === 'error' ? (
        <ErrorState onRetry={kpis.retry} message="The simulated KPI feed failed to load." />
      ) : kpis.status === 'empty' ? (
        <EmptyState
          title="No metrics yet"
          message="No KPI data has been collected. Connect roads and sensors to start measuring the network."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(kpis.data ?? []).map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          icon={Activity}
          title="Traffic flow — 24 hours"
          subtitle={`${SIMULATION.badge}: vehicles/hour vs average speed`}
          actions={<span className="chip border-sky-500/30 bg-sky-500/10 text-sky-300">Live window: today</span>}
        >
          {charts.status === 'loading' ? (
            <ChartLoadingState label="Loading traffic flow…" />
          ) : charts.status === 'error' ? (
            <ErrorState onRetry={charts.retry} message="Traffic series unavailable — simulated service error." />
          ) : charts.status === 'empty' ? (
            <EmptyState
              title="No traffic readings"
              message="The simulated feed returned no flow readings for this window."
              icon={Gauge}
            />
          ) : (
            <TrafficFlowChart />
          )}
        </Panel>

        <Panel
          icon={TrendingUp}
          title="Congestion trend"
          subtitle={`${SIMULATION.badge}: congestion index, last 7 days`}
        >
          {charts.status === 'loading' ? (
            <ChartLoadingState label="Loading trend…" />
          ) : charts.status === 'error' ? (
            <ErrorState onRetry={charts.retry} message="Trend series unavailable." />
          ) : charts.status === 'empty' ? (
            <EmptyState title="No trend data" message="Not enough days of simulated data yet." />
          ) : (
            <CongestionTrendChart />
          )}
        </Panel>
      </div>

      {/* Live predictions from the backend heuristic */}
      <PredictionPanel resource={predictions} />

      {/* Incidents + network status */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          icon={AlertTriangle}
          title="Recent incidents"
          subtitle={`${SIMULATION.badge}: reported in the last few hours`}
          actions={
            <Button variant="outline" onClick={() => onNavigate('incidents')}>
              Manage
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          }
        >
          {incidents.status === 'loading' ? (
            <LoadingState label="Loading incidents…" rows={5} />
          ) : incidents.status === 'error' ? (
            <ErrorState onRetry={incidents.retry} message="Incident feed unavailable." />
          ) : (
            <IncidentList incidents={incidents.data} onNavigate={onNavigate} />
          )}
        </Panel>

        <Panel icon={Activity} title="Congestion distribution" subtitle={`${SIMULATION.badge}: congested roads per 2 h window`}>
          {charts.status === 'loading' ? (
            <ChartLoadingState label="Loading distribution…" />
          ) : charts.status === 'error' ? (
            <ErrorState onRetry={charts.retry} />
          ) : charts.status === 'empty' ? (
            <EmptyState title="No distribution data" message="No congestion samples in this window." />
          ) : (
            <CongestionDistributionChart data={CONGESTED_ROADS_HOURLY} />
          )}
        </Panel>

        <Panel icon={Gauge} title="Most congested corridors" subtitle={`${SIMULATION.badge}: ranked by current speed`}>
          {roadsRes.status === 'loading' ? (
            <LoadingState label="Loading corridors…" rows={5} />
          ) : roadsRes.status === 'error' ? (
            <ErrorState onRetry={roadsRes.retry} message="Road feed unavailable." />
          ) : congested.length === 0 ? (
            <EmptyState title="All corridors clear" message="No heavy or severe congestion detected." />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {congested.slice(0, 5).map((road) => {
                const level = levelMeta(road.congestion);
                return (
                  <li key={road.id} className="flex items-center gap-3 px-1 py-2.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${level.bg}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-200">{road.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{road.note}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-200">{road.speedKph} km/h</p>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${level.text}`}>{level.label}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
