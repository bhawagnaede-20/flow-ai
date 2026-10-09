import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { Button } from './Panel.jsx';

/** Animated skeleton block used by the loading state. */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`} />;
}

/** Full-panel loading state. */
export function LoadingState({ label = 'Loading simulated data…', rows = 4, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Chart-area loading placeholder. */
export function ChartLoadingState({ label = 'Loading chart…' }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
      <p className="text-sm text-slate-400">{label}</p>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
      </div>
    </div>
  );
}

/** Error state with retry. */
export function ErrorState({ onRetry, title = 'Could not load this view', message }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-6 py-10 text-center"
      role="alert"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15">
        <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-slate-100">{title}</p>
        <p className="mt-1 max-w-md text-sm text-slate-400">
          {message ??
            'The simulated feed returned an error. In production this is where the API failure would surface.'}
        </p>
      </div>
      {onRetry ? (
        <Button variant="primary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Declarative boundary that swaps children for the right state view.
 * Keeps page code readable: <StateBoundary status={res.status} …>
 */
export function StateBoundary({ status, onRetry, loading, empty, children }) {
  if (status === 'loading') return loading ?? <LoadingState />;
  if (status === 'error') return <ErrorState onRetry={onRetry} />;
  if (status === 'empty') return empty ?? <EmptyState />;
  return children;
}

/** Empty state used when a list/filter has no results. */
export function EmptyState({ title = 'Nothing here yet', message, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
        <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-slate-100">{title}</p>
        {message ? <p className="mt-1 max-w-md text-sm text-slate-400">{message}</p> : null}
      </div>
      {action}
    </div>
  );
}
