import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { computeStrategyPerformance } from '@/calculations';
import { StrategyBarChart } from '@/components/charts';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, LoadingState, Modal } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useCreateStrategy, useDeleteStrategy, useStrategies } from '@/hooks/useStrategies';
import { toast } from '@/store/toastStore';
import { formatCurrency, formatPercent, formatR } from '@/utils/format';
import { cn } from '@/utils/cn';

export default function Strategies() {
  const { all, startingCapital, currency, isLoading } = usePortfolio();
  const strategiesQuery = useStrategies();
  const createStrategy = useCreateStrategy();
  const deleteStrategy = useDeleteStrategy();
  const strategies = useMemo(() => strategiesQuery.data ?? [], [strategiesQuery.data]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const perf = useMemo(
    () => computeStrategyPerformance(all, strategies, startingCapital),
    [all, strategies, startingCapital],
  );
  const chartData = perf.map((p) => ({ name: p.name, netPnl: p.netPnl }));
  const fcc = (n: number) => formatCurrency(n, currency, { compact: true });

  const create = () => {
    if (!name.trim()) {
      toast.error('Strategy name is required.');
      return;
    }
    createStrategy.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Strategy created.');
          setName('');
          setDescription('');
          setOpen(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create strategy.'),
      },
    );
  };

  if (isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Strategies"
        subtitle="Compare the edge of every setup you trade."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Strategy
          </Button>
        }
      />

      <Card className="mb-4">
        <CardHeader title="Strategy Comparison" description="Net P&L by strategy (all time)" />
        <CardBody>{chartData.length ? <StrategyBarChart data={chartData} valueFormatter={fcc} height={300} /> : <EmptyState title="No trades to compare yet" />}</CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Per-Strategy Performance" />
        {perf.length === 0 ? (
          <EmptyState title="No strategy data" message="Assign strategies to your trades to see performance here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Strategy</th>
                  <th className="px-3 py-2.5 text-right font-medium">Trades</th>
                  <th className="px-3 py-2.5 text-right font-medium">Win Rate</th>
                  <th className="px-3 py-2.5 text-right font-medium">Net P&L</th>
                  <th className="px-3 py-2.5 text-right font-medium">Avg R</th>
                  <th className="px-3 py-2.5 text-right font-medium">Expectancy</th>
                  <th className="px-3 py-2.5 text-right font-medium">Max DD</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {perf.map((p) => {
                  const custom = strategies.find((s) => s.id === p.strategyId && !s.isSystem);
                  return (
                    <tr key={p.strategyId} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-text">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {custom && <Badge tone="primary">Custom</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular text-muted">{p.totalTrades}</td>
                      <td className="px-3 py-2.5 text-right tabular text-text">{formatPercent(p.winRate)}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular font-medium', p.netPnl > 0 ? 'text-profit' : p.netPnl < 0 ? 'text-loss' : 'text-text')}>
                        {formatCurrency(p.netPnl, currency)}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right tabular', (p.averageR ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>{formatR(p.averageR)}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular', (p.expectancy ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                        {p.expectancy == null ? 'N/A' : formatCurrency(p.expectancy, currency)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular text-loss">{p.maxDrawdown === 0 ? '—' : `-${formatCurrency(p.maxDrawdown, currency)}`}</td>
                      <td className="px-3 py-2.5 text-right">
                        {custom && (
                          <button
                            type="button"
                            aria-label="Delete strategy"
                            onClick={() =>
                              deleteStrategy.mutate(p.strategyId, {
                                onSuccess: () => toast.success('Strategy removed.'),
                              })
                            }
                            className="rounded p-1.5 text-muted hover:bg-loss/10 hover:text-loss"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New Strategy" size="md">
        <div className="space-y-4">
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My breakout system" autoFocus />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={createStrategy.isPending} onClick={create}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
