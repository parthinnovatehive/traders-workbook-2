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
  name: string;
  netPnl: number;
}

interface Props {
  data: Datum[];
  height?: number;
  valueFormatter?: (n: number) => string;
}

export function StrategyBarChart({ data, height = 260, valueFormatter }: Props) {
  const fmt = valueFormatter ?? ((n: number) => n.toLocaleString());
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmt(v)} />
        <YAxis type="category" dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} width={96} />
        <ReferenceLine x={0} stroke={CHART.grid} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          contentStyle={tooltipContentStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: ChartValue) => [fmt(asNum(value)), 'Net P&L']}
        />
        <Bar dataKey="netPnl" radius={[0, 3, 3, 0]} maxBarSize={26}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.netPnl >= 0 ? CHART.profit : CHART.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
