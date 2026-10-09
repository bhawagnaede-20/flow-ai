import { ShieldCheck, Info } from 'lucide-react';
import { SIMULATION } from '../../data/simulatedData.js';

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
