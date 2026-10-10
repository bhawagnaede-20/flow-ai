import { Menu, RefreshCw, CalendarClock } from 'lucide-react';
import { findNavItem } from '../../navigation.js';
import { useDemoState } from '../../state/demoState.jsx';
import { SimulatedBadge } from '../ui/SimulatedBadge.jsx';

const today = new Date().toLocaleDateString('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Top header: brand tagline, page title, demo state preview, mobile menu. */
export default function AppHeader({ activePage, onOpenMobile }) {
  const { mode, setMode, modes } = useDemoState();
  const item = findNavItem(activePage);

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-navy-950/85 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open navigation"
          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-bold tracking-tight text-white sm:text-base">
              FLOW AI <span className="hidden font-medium text-slate-500 sm:inline">— Smarter Traffic. Safer Journeys.</span>
            </h1>
            <SimulatedBadge className="hidden shrink-0 sm:inline-flex" />
          </div>
          <p className="truncate text-xs text-slate-500">
            {item.title} · <span className="text-slate-400">{item.description}</span>
          </p>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="hidden items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-400 xl:inline-flex">
            <CalendarClock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {today}
          </span>

          {/* Preview loading / error / empty states during the demo */}
          <label className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-400">
            <RefreshCw className={`h-3.5 w-3.5 ${mode !== 'auto' ? 'text-violet-400' : 'text-slate-500'}`} aria-hidden="true" />
            <span className="sr-only">Preview UI state</span>
            <span className="hidden xl:inline">State:</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="cursor-pointer bg-transparent text-[11px] font-semibold text-slate-300 outline-none"
              title="Preview data / loading / error / empty states"
            >
              {modes.map((m) => (
                <option key={m.value} value={m.value} className="bg-navy-900 text-slate-200">
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.04] bg-violet-500/[0.06] px-4 py-1.5 sm:px-6 lg:px-8 md:hidden">
        <span className="text-[10px] font-medium text-violet-300/90">
          SIMULATED data — prototype demo, not live readings
        </span>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="cursor-pointer rounded-md border border-white/10 bg-navy-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 outline-none"
          aria-label="Preview UI state"
        >
          {modes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
