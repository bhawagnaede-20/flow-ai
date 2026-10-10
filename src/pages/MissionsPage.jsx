import { useEffect, useRef, useState } from 'react';
import { Ambulance, CheckCircle2, MapPin, Navigation, Siren, Timer, Truck } from 'lucide-react';
import { Panel, SectionHeading, Chip, Button } from '../components/ui/Panel.jsx';
import { ApiFallbackNotice, SimulatedNotice } from '../components/ui/SimulatedBadge.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateViews.jsx';
import { KpiCardSkeleton } from '../components/ui/KpiCard.jsx';
import { useApiResource } from '../api/useApiResource.js';
import { getMissions, getRoads, updateMission } from '../api/endpoints.js';
import { buildRoadNameIndex, mapMissions } from '../api/adapter.js';
import { MISSIONS, SIMULATION, missionTypeMeta, statusMeta } from '../data/simulatedData.js';

const TYPE_ICONS = { ambulance: Ambulance, fire: Truck, police: Siren };

const PRIORITY_STYLE = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-400',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
};

function MissionCard({ mission, pending, onComplete, onCancel }) {
  const type = missionTypeMeta(mission.type);
  const Icon = TYPE_ICONS[mission.type] ?? Truck;
  const status = statusMeta(mission.status);
  const isActive = mission.status === 'dispatched' || mission.status === 'en-route';

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

      {mission.progress !== null && mission.progress !== undefined ? (
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
      ) : (
        <p className="mt-4 text-[11px] text-slate-600">
          Progress not reported by the backend — no estimate is shown.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Timer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          {mission.status === 'completed'
            ? 'Mission closed'
            : mission.status === 'cancelled'
            ? 'Mission cancelled'
            : mission.etaMin > 0
            ? `ETA ${mission.etaMin} min`
            : 'Arriving now'}
        </span>
        {mission.junctionsTotal ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            {mission.junctionsCleared}/{mission.junctionsTotal} signals cleared
          </span>
        ) : null}
      </div>

      {isActive ? (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/[0.06] pt-3">
          <Button
            loading={pending === mission.id}
            disabled={Boolean(pending)}
            onClick={() => onComplete(mission.id)}
            title="Confirm completion via the backend"
          >
            Complete
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(pending)}
            onClick={() => onCancel(mission.id)}
            title="Cancel the mission via the backend"
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export default function MissionsPage() {
  const roadNamesRef = useRef(null);
  const resource = useApiResource(
    () =>
      Promise.all([getMissions(), getRoads()]).then(([missions, roads]) => {
        roadNamesRef.current = buildRoadNameIndex(roads);
        return mapMissions(missions, roadNamesRef.current);
      }),
    { fallback: MISSIONS },
  );
  const [items, setItems] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (resource.status === 'ready') setItems(resource.data);
    else if (resource.status === 'empty') setItems([]);
  }, [resource.status, resource.data]);

  const missions = items;
  const active = missions.filter((m) => m.status !== 'completed' && m.status !== 'cancelled').length;
  const completed = missions.filter((m) => m.status === 'completed').length;

  // Complete/Cancel: PATCH the backend, then update the card only from the
  // confirmed response; any failure is surfaced and changes nothing.
  const runMissionAction = async (id, status) => {
    if (pendingId) return;
    setPendingId(id);
    setActionError(null);
    try {
      const { mission } = await updateMission(id, { status });
      const [mapped] = mapMissions({ missions: [mission] }, roadNamesRef.current ?? new Map());
      setItems((prev) => prev.map((m) => (m.id === id ? mapped : m)));
    } catch (err) {
      setActionError(err?.message || 'Mission update failed — no change was applied.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Emergency missions"
        description="Green corridors reserved for ambulances, fire tenders and police units."
        actions={<Button variant="primary"><Siren className="h-3.5 w-3.5" aria-hidden="true" />Dispatch unit (demo)</Button>}
      />

      <SimulatedNotice />
      <ApiFallbackNotice resource={resource} />

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
        subtitle={`${SIMULATION.badge}: simulated dispatches with heuristic ETAs`}
      >
        {actionError ? (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs leading-relaxed text-red-300"
          >
            {actionError}
          </p>
        ) : null}
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
              <MissionCard
                key={mission.id}
                mission={mission}
                pending={pendingId}
                onComplete={(id) => runMissionAction(id, 'completed')}
                onCancel={(id) => runMissionAction(id, 'cancelled')}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
