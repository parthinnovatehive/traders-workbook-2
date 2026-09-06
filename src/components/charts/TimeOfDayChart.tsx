import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimeOfDayPoint } from '@/calculations/series';
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
  data: TimeOfDayPoint[];
  height?: number;
  valueFormatter?: (n: number) => string;
}

export function TimeOfDayChart({ data, height = 240, valueFormatter }: Props) {
  const fmt = valueFormatter ?? ((n: number) => n.toLocaleString());
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => fmt(v)} />
        <ReferenceLine y={0} stroke={CHART.grid} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          contentStyle={tooltipContentStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: ChartValue) => [fmt(asNum(value)), 'Net P&L']}
        />
        <Bar dataKey="netPnl" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {data.map((d) => (
            <Cell key={d.hour} fill={d.netPnl >= 0 ? CHART.profit : CHART.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
