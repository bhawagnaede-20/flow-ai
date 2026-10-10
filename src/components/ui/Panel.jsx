import { Loader2 } from 'lucide-react';

/** Rounded glass panel used across every page. */
export function Panel({ title, subtitle, icon: Icon, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`panel animate-fade-in p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon ? (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04]">
                <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
              </span>
            ) : null}
            <div>
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
              {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
            </div>
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

const VARIANTS = {
  primary:
    'bg-accent text-navy-950 hover:bg-accent-soft border border-transparent font-semibold',
  ghost:
    'bg-white/[0.05] text-slate-200 hover:bg-white/[0.09] border border-white/10',
  outline:
    'bg-transparent text-slate-300 hover:bg-white/[0.06] border border-white/15',
};

export function Button({ variant = 'ghost', className = '', loading = false, children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/** Small status chip. */
export function Chip({ className = '', children }) {
  return <span className={`chip ${className}`}>{children}</span>;
}

/** Section title used on page level. */
export function SectionHeading({ title, description, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
