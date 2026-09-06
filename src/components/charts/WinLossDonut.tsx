import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART, tooltipContentStyle, tooltipItemStyle } from './chart-theme';

interface Props {
  wins: number;
  losses: number;
  breakevens: number;
  height?: number;
}

export function WinLossDonut({ wins, losses, breakevens, height = 220 }: Props) {
  const data = [
    { name: 'Wins', value: wins, color: CHART.profit },
    { name: 'Losses', value: losses, color: CHART.loss },
    { name: 'Breakeven', value: breakevens, color: CHART.muted },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--surface)"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipContentStyle} itemStyle={tooltipItemStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
