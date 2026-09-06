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
import type { RBucket } from '@/calculations/series';
import {
  asNum,
  axisTick,
  CHART,
  type ChartValue,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chart-theme';

export function RDistributionChart({ data, height = 240 }: { data: RBucket[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="bucket" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <ReferenceLine x="0R" stroke={CHART.grid} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          contentStyle={tooltipContentStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: ChartValue) => [String(asNum(value)), 'Trades']}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {data.map((d) => (
            <Cell key={d.bucket} fill={d.from >= 0 ? CHART.profit : CHART.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
