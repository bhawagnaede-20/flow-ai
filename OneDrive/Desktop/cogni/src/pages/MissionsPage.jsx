import { Ambulance, CheckCircle2, MapPin, Navigation, Siren, Timer, Truck } from 'lucide-react';
import { Panel, SectionHeading, Chip, Button } from '../components/ui/Panel.jsx';
import { SimulatedNotice } from '../components/ui/SimulatedBadge.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateViews.jsx';
import { KpiCardSkeleton } from '../components/ui/KpiCard.jsx';
import { useSimulatedResource } from '../hooks/useSimulatedResource.js';
import { MISSIONS, SIMULATION, missionTypeMeta, statusMeta } from '../data/simulatedData.js';

const TYPE_ICONS = { ambulance: Ambulance, fire: Truck, police: Siren };

const PRIORITY_STYLE = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-400',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
};

function MissionCard({ mission }) {
  const type = missionTypeMeta(mission.type);
  const Icon = TYPE_ICONS[mission.type] ?? Truck;
  const status = statusMeta(mission.status);

  return (
    <article className="panel flex flex-col p-4 transition hover:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10">
            <Icon className="h-5 w-5 text-sky-400" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">{mission.unit}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{mission.id}</span>
            </div>
            <p className="truncate text-xs text-slate-400">{type.label} · {mission.task}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Chip className={PRIORITY_STYLE[mission.priority] ?? 'border-slate-500/30 bg-slate-500/10 text-slate-400'}>
            {mission.priority}
          </Chip>
          <Chip className={status.chip}>{status.label}</Chip>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-2 text-xs">
        <div className="flex items-start gap-2 text-slate-400">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
          <span className="truncate">{mission.from} → {mission.to}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Navigation className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
          <span className="truncate">{mission.corridor}</span>
        </div>
      </dl>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Green-corridor progress</span>
          <span className="font-semibold text-slate-300">{mission.progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              mission.priority === 'critical' ? 'bg-red-400' : mission.status === 'completed' ? 'bg-emerald-400' : 'bg-sky-400'
            }`}
            style={{ width: `${mission.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Timer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          {mission.status === 'completed'
            ? 'Mission closed'
            : mission.etaMin > 0
            ? `ETA ${mission.etaMin} min`
            : 'Arriving now'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          {mission.junctionsCleared}/{mission.junctionsTotal} signals cleared
        </span>
      </div>
    </article>
  );
}

export default function MissionsPage() {
  const resource = useSimulatedResource(() => MISSIONS);
  const missions = resource.data ?? [];
  const active = missions.filter((m) => m.status !== 'completed').length;
  const completed = missions.filter((m) => m.status === 'completed').length;

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Emergency missions"
        description="Green corridors reserved for ambulances, fire tenders and police units."
        actions={<Button variant="primary"><Siren className="h-3.5 w-3.5" aria-hidden="true" />Dispatch unit (demo)</Button>}
      />

      <SimulatedNotice />

      {resource.status === 'loading' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : resource.status === 'error' ? (
        <ErrorState onRetry={resource.retry} message="Mission control feed unavailable — simulated error." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total missions', value: missions.length },
            { label: 'Active now', value: active },
            { label: 'Completed', value: completed },
            { label: 'Critical priority', value: missions.filter((m) => m.priority === 'critical').length },
          ].map((stat) => (
            <div key={stat.label} className="panel p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <Panel
        icon={Navigation}
        title="Mission board"
        subtitle={`${SIMULATION.badge}: sample dispatches with simulated ETAs`}
      >
        {resource.status === 'loading' ? (
          <LoadingState label="Loading missions…" rows={5} />
        ) : resource.status === 'error' ? (
          <ErrorState onRetry={resource.retry} />
        ) : missions.length === 0 ? (
          <EmptyState
            icon={Ambulance}
            title="No emergency missions"
            message="No dispatches in the simulated queue. Units are standing by at their stations."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {missions.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
