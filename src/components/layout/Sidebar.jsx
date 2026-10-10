import { X, Radar, ChevronRight } from 'lucide-react';
import { NAV_ITEMS } from '../../navigation.js';
import { SimulatedBadge } from '../ui/SimulatedBadge.jsx';

function Brand({ onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate('dashboard')}
      className="flex w-full items-center gap-3 px-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-xl"
    >
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-glow">
        <Radar className="h-5 w-5 text-navy-950" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold tracking-[0.18em] text-white">FLOW AI</span>
        <span className="block truncate text-[11px] text-slate-500">Smarter Traffic. Safer Journeys.</span>
      </span>
    </button>
  );
}

function NavList({ activePage, onNavigate, onNavigateDone, compact = false }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = item.id === activePage;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              onNavigate(item.id);
              onNavigateDone?.();
            }}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              active
                ? 'bg-accent/10 text-accent-soft shadow-[inset_0_0_0_1px_rgba(56,189,248,0.25)]'
                : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
            }`}
          >
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${
                active ? 'bg-accent/15' : 'bg-white/[0.04] group-hover:bg-white/[0.08]'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-accent' : ''}`} aria-hidden="true" />
            </span>
            <span className="flex-1 text-left">{compact ? item.shortLabel : item.label}</span>
            {active ? <ChevronRight className="h-4 w-4 opacity-70" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar (fixed) + mobile drawer in one component. */
export default function Sidebar({ activePage, onNavigate, mobileOpen, onCloseMobile }) {
  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.06] bg-navy-900/90 p-4 backdrop-blur lg:flex">
        <Brand onNavigate={onNavigate} />
        <div className="mt-6 flex-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Operations
          </p>
          <NavList activePage={activePage} onNavigate={onNavigate} />
        </div>
        <div className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-violet-400" />
            </span>
            <span className="text-[11px] font-semibold text-slate-300">Simulated feed</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Hackathon prototype. Sample dataset only — no live sensors or backend connected.
          </p>
          <SimulatedBadge />
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={onCloseMobile}
          className={`absolute inset-0 bg-navy-950/80 backdrop-blur-sm transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-white/[0.06] bg-navy-900 p-4 shadow-panel transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <Brand onNavigate={onNavigate} />
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavList activePage={activePage} onNavigate={onNavigate} onNavigateDone={onCloseMobile} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <span className="text-[11px] text-slate-500">Sample dataset only</span>
            <SimulatedBadge />
          </div>
        </aside>
      </div>
    </>
  );
}
