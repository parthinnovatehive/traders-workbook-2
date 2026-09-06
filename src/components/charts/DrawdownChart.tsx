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

/** Underwater curve — plots drawdown as a negative area below zero. */
export function DrawdownChart({ data, height = 220, valueFormatter }: Props) {
  const fmt = valueFormatter ?? ((n: number) => n.toLocaleString());
  const series = data.map((p) => ({ index: p.index, drawdown: -p.drawdown }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.loss} stopOpacity={0} />
            <stop offset="100%" stopColor={CHART.loss} stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="index" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => fmt(v)} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: ChartValue) => [fmt(Math.abs(asNum(value))), 'Drawdown']}
          labelFormatter={(l) => `Trade #${l}`}
        />
        <Area type="monotone" dataKey="drawdown" stroke={CHART.loss} strokeWidth={1.5} fill="url(#ddFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
