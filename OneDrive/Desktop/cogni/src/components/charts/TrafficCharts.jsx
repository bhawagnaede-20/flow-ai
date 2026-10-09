import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip, { AXIS_STYLE } from './ChartTooltip.jsx';
import { CONGESTION_TREND_7D, TRAFFIC_FLOW_24H } from '../../data/simulatedData.js';

const GRID = { stroke: '#16233f', strokeDasharray: '4 6' };

/** 24h traffic volume + average speed (simulated). */
export function TrafficFlowChart() {
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={TRAFFIC_FLOW_24H} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="hour" {...AXIS_STYLE} interval={2} />
          <YAxis yAxisId="left" {...AXIS_STYLE} width={46} />
          <YAxis yAxisId="right" orientation="right" {...AXIS_STYLE} width={34} domain={[0, 70]} />
          <Tooltip
            content={
              <ChartTooltip
                formatter={(value, entry) =>
                  entry.dataKey === 'speed' ? `${value} km/h` : `${value} veh/h`
                }
              />
            }
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="volume"
            name="Volume"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#volumeFill)"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="speed"
            name="Avg speed"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 7-day congestion index, morning vs evening peak (simulated). */
export function CongestionTrendChart() {
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={CONGESTION_TREND_7D} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="day" {...AXIS_STYLE} />
          <YAxis {...AXIS_STYLE} width={46} domain={[0, 100]} />
          <Tooltip content={<ChartTooltip formatter={(v) => `${v} / 100`} />} />
          <Line type="monotone" dataKey="morning" name="Morning peak" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="evening" name="Evening peak" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Hourly distribution of current congestion across monitored roads (simulated). */
export function CongestionDistributionChart({ data }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="hour" {...AXIS_STYLE} />
          <YAxis {...AXIS_STYLE} width={44} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip formatter={(v) => `${v} roads`} />} />
          <Bar dataKey="roads" name="Congested roads" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
