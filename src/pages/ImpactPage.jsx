import { BarChart3, CloudSun, Leaf, Recycle } from 'lucide-react';
import { Panel, SectionHeading, Button } from '../components/ui/Panel.jsx';
import KpiCard, { KpiCardSkeleton } from '../components/ui/KpiCard.jsx';
import { SimulatedNotice } from '../components/ui/SimulatedBadge.jsx';
import { ChartLoadingState, EmptyState, ErrorState } from '../components/ui/StateViews.jsx';
import { Co2WeeklyChart, IdleSavingsChart } from '../components/charts/EnvironmentalCharts.jsx';
import { useSimulatedResource } from '../hooks/useSimulatedResource.js';
import { ENVIRONMENT, SIMULATION } from '../data/simulatedData.js';

export default function ImpactPage() {
  const summary = useSimulatedResource(() => ENVIRONMENT.summary);
  const charts = useSimulatedResource(() => ({ ok: true }));

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Environmental impact"
        description="Estimated emissions and fuel savings produced by FLOW AI's signal optimisation (simulated)."
        actions={
          <Button variant="outline">
            <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
            Download report (demo)
          </Button>
        }
      />

      <SimulatedNotice />

      {summary.status === 'loading' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : summary.status === 'error' ? (
        <ErrorState onRetry={summary.retry} message="Environmental metrics unavailable — simulated error." />
      ) : summary.status === 'empty' ? (
        <EmptyState icon={Leaf} title="No impact data yet" message="Emissions savings appear once corridors are optimised for a full day." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ENVIRONMENT.summary.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          icon={CloudSun}
          title="Weekly CO₂ avoided"
          subtitle={`${SIMULATION.badge}: kilograms per week, last 8 weeks`}
        >
          {charts.status === 'loading' ? (
            <ChartLoadingState label="Loading emissions data…" />
          ) : charts.status === 'error' ? (
            <ErrorState onRetry={charts.retry} message="Emissions series unavailable." />
          ) : charts.status === 'empty' ? (
            <EmptyState icon={CloudSun} title="No emissions data" message="No weekly samples collected yet." />
          ) : (
            <Co2WeeklyChart />
          )}
        </Panel>

        <Panel
          icon={BarChart3}
          title="Idling time avoided today"
          subtitle={`${SIMULATION.badge}: minutes of stop-go removed per window`}
        >
          {charts.status === 'loading' ? (
            <ChartLoadingState label="Loading savings data…" />
          ) : charts.status === 'error' ? (
            <ErrorState onRetry={charts.retry} message="Savings series unavailable." />
          ) : charts.status === 'empty' ? (
            <EmptyState title="No savings recorded" message="Idling data will appear after the first optimised cycle." />
          ) : (
            <IdleSavingsChart />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" icon={Recycle} title="Where the savings come from" subtitle={`${SIMULATION.badge}: contribution share`}>
          {charts.status === 'loading' ? (
            <ChartLoadingState label="Loading breakdown…" />
          ) : charts.status === 'error' ? (
            <ErrorState onRetry={charts.retry} />
          ) : (
            <ul className="space-y-4">
              {ENVIRONMENT.breakdown.map((row) => (
                <li key={row.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="font-semibold text-slate-100">{row.share}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${row.share}%`, background: row.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={Leaf} title="Method notes" subtitle="How the prototype estimates savings">
          <ul className="space-y-3 text-xs leading-relaxed text-slate-400">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
              CO₂ avoided is derived from simulated reductions in idle minutes × a fixed emission factor.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" aria-hidden="true" />
              Fuel saved is the litres equivalent of that idle time (approx. 0.44 L/h idle).
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
              Tree-equivalent uses 21 kg CO₂ absorbed per tree per year.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden="true" />
              All inputs are sample values — <strong className="font-semibold text-violet-300">SIMULATED</strong>, not measured from sensors.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
