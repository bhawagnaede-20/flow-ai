import { useMemo, useState } from 'react';
import { Filter, MapPin } from 'lucide-react';
import TrafficMap, { CongestionLegend } from '../components/map/TrafficMap.jsx';
import { Panel, SectionHeading, Chip, Button } from '../components/ui/Panel.jsx';
import { SimulatedNotice } from '../components/ui/SimulatedBadge.jsx';
import {
  ChartLoadingState,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui/StateViews.jsx';
import { useSimulatedResource } from '../hooks/useSimulatedResource.js';
import { CONGESTION_LEVELS, ROAD_SEGMENTS, SIMULATION, levelMeta } from '../data/simulatedData.js';

const FILTERS = [{ key: 'all', label: 'All corridors' }, ...CONGESTION_LEVELS.map((l) => ({ key: l.key, label: l.label }))];

export default function TrafficMapPage() {
  const resource = useSimulatedResource(() => ROAD_SEGMENTS);
  const [filter, setFilter] = useState('all');

  const roads = useMemo(() => {
    const all = resource.data ?? [];
    return filter === 'all' ? all : all.filter((r) => r.congestion === filter);
  }, [resource.data, filter]);

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Traffic map"
        description="Sample corridors with congestion markers — the basemap is real, the traffic values are simulated."
        actions={<Button variant="ghost">Export view (demo)</Button>}
      />

      <SimulatedNotice />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          icon={MapPin}
          title="Corridor congestion"
          subtitle={`${SIMULATION.badge}: 10 sample roads around Bengaluru`}
          actions={
            <div className="hidden items-center gap-2 sm:flex">
              <Chip className="border-white/10 bg-white/[0.04] text-slate-400">Basemap: CARTO dark</Chip>
            </div>
          }
          bodyClassName="relative"
        >
          {resource.status === 'loading' ? (
            <ChartLoadingState label="Loading map…" />
          ) : resource.status === 'error' ? (
            <ErrorState onRetry={resource.retry} message="The simulated road feed failed to load." />
          ) : (
            <div className="relative">
              <TrafficMap roads={roads} />
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel icon={Filter} title="Filter corridors" subtitle="Filter by congestion level">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                const level = CONGESTION_LEVELS.find((l) => l.key === f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      active
                        ? 'border-accent/50 bg-accent/15 text-accent-soft'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                    }`}
                    style={active && level ? { borderColor: `${level.color}66`, background: `${level.color}1a`, color: level.color } : undefined}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 lg:hidden">
              <CongestionLegend />
            </div>
          </Panel>

          <Panel title="Corridor list" subtitle={`${SIMULATION.badge}: speeds are simulated`} bodyClassName="max-h-[420px] overflow-y-auto pr-1">
            {resource.status === 'loading' ? (
              <LoadingState label="Loading corridors…" rows={5} />
            ) : resource.status === 'error' ? (
              <ErrorState onRetry={resource.retry} />
            ) : roads.length === 0 ? (
              <EmptyState
                title="No roads match this filter"
                message="Try a different congestion level to see sample corridors."
                action={
                  <Button variant="outline" onClick={() => setFilter('all')}>
                    Clear filter
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {roads.map((road) => {
                  const level = levelMeta(road.congestion);
                  return (
                    <li key={road.id} className="flex items-center gap-3 py-2.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${level.bg}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-200">{road.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {road.speedKph} km/h · {road.volume.toLocaleString()} veh/h
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${level.text}`}>{level.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
