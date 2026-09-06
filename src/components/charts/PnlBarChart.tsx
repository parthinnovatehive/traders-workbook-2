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
import {
  asNum,
  axisTick,
  CHART,
  type ChartValue,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chart-theme';

interface Datum {
  label: string;
  netPnl: number;
}

interface Props {
  data: Datum[];
  height?: number;
  valueFormatter?: (n: number) => string;
}

export function PnlBarChart({ data, height = 260, valueFormatter }: Props) {
  const fmt = valueFormatter ?? ((n: number) => n.toLocaleString());
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval="preserveStartEnd" />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => fmt(v)} />
        <ReferenceLine y={0} stroke={CHART.grid} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          contentStyle={tooltipContentStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: ChartValue) => [fmt(asNum(value)), 'Net P&L']}
        />
        <Bar dataKey="netPnl" radius={[3, 3, 0, 0]} maxBarSize={48}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.netPnl >= 0 ? CHART.profit : CHART.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
