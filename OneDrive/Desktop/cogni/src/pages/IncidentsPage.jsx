import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Filter, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { Panel, SectionHeading, Chip, Button } from '../components/ui/Panel.jsx';
import { SimulatedNotice } from '../components/ui/SimulatedBadge.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateViews.jsx';
import { IncidentRow } from '../components/incidents/IncidentList.jsx';
import { useSimulatedResource } from '../hooks/useSimulatedResource.js';
import { INCIDENTS, SIMULATION, severityMeta, statusMeta, timeAgo } from '../data/simulatedData.js';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'resolved', label: 'Resolved' },
];

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low'];

export default function IncidentsPage() {
  const resource = useSimulatedResource(() => INCIDENTS);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [query, setQuery] = useState('');

  // Local, UI-only copy so acknowledge/resolve actions feel instant in the demo.
  useEffect(() => {
    if (resource.status === 'ready') setItems(resource.data);
  }, [resource.status, resource.data]);

  const counts = useMemo(
    () => ({
      all: items.length,
      open: items.filter((i) => i.status === 'open').length,
      acknowledged: items.filter((i) => i.status === 'acknowledged').length,
      resolved: items.filter((i) => i.status === 'resolved').length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((incident) => {
      const statusOk = statusFilter === 'all' || incident.status === statusFilter;
      const severityOk = severityFilter === 'all' || incident.severity === severityFilter;
      const queryOk =
        !q ||
        incident.title.toLowerCase().includes(q) ||
        incident.road.toLowerCase().includes(q) ||
        incident.id.toLowerCase().includes(q);
      return statusOk && severityOk && queryOk;
    });
  }, [items, statusFilter, severityFilter, query]);

  const updateStatus = (id, status) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));

  const clearFilters = () => {
    setStatusFilter('all');
    setSeverityFilter('all');
    setQuery('');
  };

  const hasFilters = statusFilter !== 'all' || severityFilter !== 'all' || query.trim() !== '';

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Incident management"
        description="Report, acknowledge and resolve road incidents from a single queue."
        actions={
          <Button variant="ghost" onClick={clearFilters}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset filters
          </Button>
        }
      />

      <SimulatedNotice />

      <Panel icon={Filter} title="Filters" subtitle={`${SIMULATION.badge}: ${counts.all} sample incidents`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              const count = counts[f.key] ?? 0;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active
                      ? 'border-accent/50 bg-accent/15 text-accent-soft'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                  }`}
                >
                  {f.label}
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-accent/20' : 'bg-white/[0.08] text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 sm:min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <span className="sr-only">Search incidents</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search road, ID or title…"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            </label>

            <label className="relative">
              <span className="sr-only">Severity</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 outline-none focus:border-accent/40"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s} className="bg-navy-900">
                    {s === 'all' ? 'All severities' : `${s[0].toUpperCase()}${s.slice(1)} severity`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Panel>

      <Panel
        icon={ShieldCheck}
        title="Incident queue"
        subtitle="Action buttons only update this demo view — no backend is connected"
        actions={
          <Chip className="border-sky-500/30 bg-sky-500/10 text-sky-300">
            {filtered.length} shown
          </Chip>
        }
      >
        {resource.status === 'loading' ? (
          <LoadingState label="Loading incident queue…" rows={6} />
        ) : resource.status === 'error' ? (
          <ErrorState onRetry={resource.retry} message="The incident service returned an error (simulated)." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No incidents match your filters' : 'No incidents reported'}
            message={
              hasFilters
                ? 'Try clearing the filters or searching for a different road or incident ID.'
                : 'The simulated queue is empty — every road is running smoothly.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {filtered.map((incident) => {
              const status = statusMeta(incident.status);
              const severity = severityMeta(incident.severity);
              return (
                <li key={incident.id} className="py-1">
                  <div className="flex flex-col gap-3 px-1 py-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <IncidentRow incident={incident} as="div" />
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 px-1 pb-2 sm:pb-0">
                      <span className="hidden text-[11px] text-slate-500 md:inline">{incident.owner}</span>
                      <Chip className={severity.chip}>{severity.label}</Chip>
                      <Chip className={status.chip}>{status.label}</Chip>
                      {incident.status !== 'acknowledged' && incident.status !== 'resolved' ? (
                        <Button onClick={() => updateStatus(incident.id, 'acknowledged')}>Acknowledge</Button>
                      ) : null}
                      {incident.status !== 'resolved' ? (
                        <Button variant="primary" onClick={() => updateStatus(incident.id, 'resolved')}>
                          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Resolve
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
