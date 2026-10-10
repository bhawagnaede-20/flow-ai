import { Activity, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Panel } from '../ui/Panel.jsx';
import { ChartLoadingState, EmptyState, ErrorState } from '../ui/StateViews.jsx';
import { levelMeta } from '../../data/simulatedData.js';

const TREND_ICON = { rising: TrendingUp, falling: TrendingDown, stable: Minus };
const TREND_TEXT = { rising: 'Rising', falling: 'Falling', stable: 'Stable' };

/** Backend congestion category -> frontend level key (same table as adapter). */
const CATEGORY_LEVEL = { smooth: 'free', moderate: 'moderate', congested: 'heavy', gridlock: 'severe' };

/**
 * Dashboard panel listing GET /api/predictions results.
 * Renders the resource's own loading/error/empty states — when the backend is
 * down and no demo predictions exist, it shows the error state (never fake rows).
 */
export default function PredictionPanel({ resource }) {
  const { status, data, retry } = resource;
  const rows = (data ?? [])
    .slice()
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
    .slice(0, 5);

  return (
    <Panel
      icon={Activity}
      title="Congestion predictions"
      subtitle="Deterministic heuristic · model not trained · simulated advisory only"
    >
      {status === 'loading' ? (
        <ChartLoadingState label="Loading predictions…" />
      ) : status === 'error' ? (
        <ErrorState
          onRetry={retry}
          title="Predictions unavailable"
          message="The backend did not return predictions, and this prototype has no demo dataset for them."
        />
      ) : status === 'empty' ? (
        <EmptyState title="No predictions" message="The backend returned an empty prediction set." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {rows.map((p) => {
            const level = levelMeta(CATEGORY_LEVEL[p.category] ?? 'moderate');
            const TrendIcon = TREND_ICON[p.trend] ?? Minus;
            return (
              <li key={p.roadId} className="flex items-start gap-3 py-2.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${level.bg}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm text-slate-200">{p.roadName}</p>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${level.text}`}>
                      {level.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                      <TrendIcon className="h-3 w-3" aria-hidden="true" />
                      {TREND_TEXT[p.trend] ?? p.trend}
                    </span>
                    <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-300">
                      risk {p.riskScore}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{p.recommendation}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
