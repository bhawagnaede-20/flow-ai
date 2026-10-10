import { ArrowRight, MapPin } from 'lucide-react';
import { severityMeta, statusMeta, timeAgo } from '../../data/simulatedData.js';
import { Chip } from '../ui/Panel.jsx';

/**
 * Single incident row — reused by the dashboard list and the incidents page.
 * `as` lets the incidents page render it inside its own list item markup.
 */
export function IncidentRow({ incident, showRoad = true, dense = false, as: Tag = 'li' }) {
  const severity = severityMeta(incident.severity);
  const status = statusMeta(incident.status);

  return (
    <Tag className="group flex items-start gap-3 rounded-xl border border-transparent px-2 py-2.5 transition hover:border-white/[0.06] hover:bg-white/[0.03]">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${severity.dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-medium text-slate-200">{incident.title}</p>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{incident.id}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {showRoad ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-slate-600" aria-hidden="true" />
              {incident.road}
            </span>
          ) : null}
          <span>{timeAgo(incident.minutesAgo)}</span>
          {!dense ? <span>{incident.lanes}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Chip className={severity.chip}>{severity.label}</Chip>
        <Chip className={status.chip}>{status.label}</Chip>
      </div>
    </Tag>
  );
}

/** Compact recent-incidents list for the dashboard. */
export default function IncidentList({ incidents, onNavigate, emptyMessage }) {
  if (!incidents?.length) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
        {emptyMessage ?? 'No incidents to show right now.'}
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-white/[0.05]">
        {incidents.map((incident) => (
          <IncidentRow key={incident.id} incident={incident} />
        ))}
      </ul>
      {onNavigate ? (
        <button
          type="button"
          onClick={() => onNavigate('incidents')}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          View all incidents
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
