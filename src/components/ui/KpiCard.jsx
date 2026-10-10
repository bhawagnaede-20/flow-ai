import {
  AlertTriangle,
  Clock,
  CloudSun,
  Fuel,
  Leaf,
  Route,
  Siren,
  Timer,
  TrafficCone,
  TrendingDown,
  TrendingUp,
  TreePine,
} from 'lucide-react';
import { Skeleton } from './StateViews.jsx';

const ICONS = {
  Route,
  TrafficCone,
  AlertTriangle,
  Siren,
  Clock,
  Leaf,
  CloudSun,
  Fuel,
  Timer,
  TreePine,
};

const TONES = {
  sky: { icon: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  emerald: { icon: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  orange: { icon: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  red: { icon: 'text-red-400 bg-red-500/10 border-red-500/20' },
  violet: { icon: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  amber: { icon: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

/** KPI metric card used on the dashboard and impact pages. */
export function KpiCard({ kpi }) {
  const Icon = ICONS[kpi.icon] ?? Route;
  const tone = TONES[kpi.tone] ?? TONES.sky;
  const TrendIcon = kpi.deltaTrend === 'down' ? TrendingDown : TrendingUp;
  const trendColor =
    kpi.deltaTrend === 'down' ? 'text-orange-400' : kpi.deltaTrend === 'flat' ? 'text-slate-400' : 'text-emerald-400';

  return (
    <article className="panel group relative overflow-hidden p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/10 sm:p-5">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition group-hover:opacity-[0.14]"
        style={{ background: 'currentColor' }}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-white">{kpi.value}</span>
            {kpi.unit ? <span className="text-xs font-medium text-slate-500">{kpi.unit}</span> : null}
          </p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} aria-hidden="true" />
        <span className={`text-xs font-medium ${trendColor}`}>{kpi.delta}</span>
      </div>
      {kpi.hint ? <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{kpi.hint}</p> : null}
    </article>
  );
}

/** Skeleton placeholder matching the KPI card geometry. */
export function KpiCardSkeleton() {
  return (
    <div className="panel p-4 sm:p-5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-4 h-3 w-32" />
    </div>
  );
}

export default KpiCard;
