import { ShieldCheck, Info, WifiOff } from 'lucide-react';
import { SIMULATION } from '../../data/simulatedData.js';
import { DEMO_FALLBACK_NOTICE } from '../../api/endpoints.js';

/**
 * Prominent SIMULATED badge. Used everywhere data is rendered so nobody
 * mistakes the prototype's sample dataset for live readings.
 */
export function SimulatedBadge({ className = '' }) {
  return (
    <span
      className={`chip border-violet-500/30 bg-violet-500/10 text-violet-300 ${className}`}
      title="Sample dataset — not live data"
    >
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      {SIMULATION.badge}
    </span>
  );
}

/** Inline notice explaining that the data is simulated. */
export function SimulatedNotice({ className = '' }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-3 py-2 text-xs leading-relaxed text-violet-200/90 ${className}`}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden="true" />
      <span>
        <strong className="font-semibold text-violet-100">SIMULATED —</strong> {SIMULATION.notice}
      </span>
    </p>
  );
}

/**
 * Amber banner shown when a resource fell back to the built-in demo dataset
 * because the backend was unreachable. Renders nothing for backend data.
 * Accepts one resource or an array of resources.
 */
export function ApiFallbackNotice({ resources }) {
  const list = Array.isArray(resources) ? resources : [resources];
  const failed = list.filter((r) => r && r.source === 'demo');
  if (failed.length === 0) return null;
  const detail = failed.find((r) => r.error)?.error?.message;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-xs leading-relaxed text-amber-200/90"
    >
      <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
      <span>
        <strong className="font-semibold text-amber-100">DEMO FALLBACK —</strong>{' '}
        {DEMO_FALLBACK_NOTICE}
        {detail ? <span className="text-amber-300/80"> ({detail})</span> : null}
      </span>
    </p>
  );
}
