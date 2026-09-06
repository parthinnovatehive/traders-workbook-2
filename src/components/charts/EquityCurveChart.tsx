import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EquityPoint } from '@/types';
import {
  asNum,
  axisTick,
  CHART,
  type ChartValue,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chart-theme';

interface Props {
  data: EquityPoint[];
  height?: number;
  valueFormatter?: (n: number) => string;
}

export function EquityCurveChart({ data, height = 260, valueFormatter }: Props) {
  const fmt = valueFormatter ?? ((n: number) => n.toLocaleString());
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="index" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) => fmt(v)}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: ChartValue) => [fmt(asNum(value)), 'Equity']}
          labelFormatter={(l) => `Trade #${l}`}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={CHART.primary}
          strokeWidth={2}
          fill="url(#equityFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
