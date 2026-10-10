import { useState } from 'react';
import { FastForward, RotateCcw } from 'lucide-react';
import { Button } from './Panel.jsx';
import { stepSimulation, resetSimulation } from '../../api/endpoints.js';

/**
 * Simulation step / reset controls (calls POST /api/simulation/step and
 * /api/simulation/reset).
 *
 * Success is only reported after the backend responds — `onAdvanced` runs
 * strictly after a confirmed 2xx envelope; every failure surfaces as an error
 * message and changes nothing.
 */
export default function SimulationControls({ clock, step, enabled = true, onAdvanced }) {
  const [pending, setPending] = useState(null); // 'step' | 'reset' | null
  const [error, setError] = useState(null);

  const run = async (kind, fn) => {
    if (pending || !enabled) return;
    setPending(kind);
    setError(null);
    try {
      const result = await fn(); // throws ApiError on any failure
      onAdvanced?.(result); // reached only with backend confirmation
    } catch (err) {
      setError(err?.message || 'Simulation request failed — nothing changed.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300">{enabled && clock ? clock : '—'}</span>
          <span>· step {enabled && step !== null && step !== undefined ? step : '—'}</span>
        </span>
        <Button
          variant="primary"
          loading={pending === 'step'}
          disabled={!enabled || pending !== null}
          title="Advance the simulated clock by one step (5 minutes)"
          onClick={() => run('step', () => stepSimulation(1))}
        >
          <FastForward className="h-3.5 w-3.5" aria-hidden="true" />
          Advance 5 min
        </Button>
        <Button
          variant="outline"
          loading={pending === 'reset'}
          disabled={!enabled || pending !== null}
          title="Reset the simulation to its deterministic seed state"
          onClick={() => run('reset', () => resetSimulation())}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset sim
        </Button>
      </div>
      {error ? (
        <p role="alert" className="max-w-md text-right text-[11px] leading-snug text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
