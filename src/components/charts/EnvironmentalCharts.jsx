import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip, { AXIS_STYLE } from './ChartTooltip.jsx';
import { ENVIRONMENT } from '../../data/simulatedData.js';

const GRID = { stroke: '#16233f', strokeDasharray: '4 6' };

/** Weekly CO₂ avoided (kg) — simulated. */
export function Co2WeeklyChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={ENVIRONMENT.weekly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="week" {...AXIS_STYLE} />
          <YAxis {...AXIS_STYLE} width={44} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip formatter={(v) => `${v} kg CO₂`} />} />
          <Bar dataKey="co2" name="CO₂ avoided" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Hourly idling minutes avoided today — simulated. */
export function IdleSavingsChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={ENVIRONMENT.hourlySavings} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="idleFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="hour" {...AXIS_STYLE} />
          <YAxis {...AXIS_STYLE} width={44} />
          <Tooltip content={<ChartTooltip formatter={(v, e) => (e.dataKey === 'co2' ? `${v} g CO₂` : `${v} min`)} />} />
          <Area type="monotone" dataKey="idle" name="Idle minutes avoided" stroke="#38bdf8" strokeWidth={2} fill="url(#idleFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
