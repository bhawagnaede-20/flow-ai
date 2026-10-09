/** Dark styled tooltip shared by all Recharts visuals. */
export default function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-navy-950/95 px-3 py-2 shadow-panel backdrop-blur">
      {label !== undefined && label !== null ? (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: entry.color ?? entry.fill }}
              aria-hidden="true"
            />
            <span className="text-slate-400">{entry.name}</span>
            <span className="ml-auto font-semibold text-slate-100">
              {formatter ? formatter(entry.value, entry) : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const AXIS_STYLE = {
  tick: { fill: '#64748b', fontSize: 11 },
  axisLine: { stroke: '#1b2c52' },
  tickLine: false,
};
