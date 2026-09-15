import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import type { ISODate, Trade } from '@/types';
import {
  computeDayStatsMap,
  computeTradeMetrics,
  peakAbsPnl,
  summarisePeriod,
  type DayStats,
} from '@/calculations';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, LoadingState, MetricCard, Modal } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { TradeForm } from '@/components/forms/TradeForm';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useDeleteTrade } from '@/hooks/useTrades';
import { toast } from '@/store/toastStore';
import { formatCompactCurrency, formatCompactSignedCurrency, formatCurrency, formatPercent, formatR } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Heat intensity for a day cell, scaled to the trader's own biggest day in the
 * month so a ₹500 day still reads as green for someone who trades small.
 */
function heatClass(netPnl: number, peak: number): string {
  if (netPnl === 0 || peak === 0) return '';
  const ratio = Math.min(Math.abs(netPnl) / peak, 1);
  const step = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
  if (netPnl > 0) {
    return step === 3 ? 'bg-profit/25' : step === 2 ? 'bg-profit/15' : 'bg-profit/8';
  }
  return step === 3 ? 'bg-loss/25' : step === 2 ? 'bg-loss/15' : 'bg-loss/8';
}

export default function Calendar() {
  const { all, currency, startingCapital, isLoading } = usePortfolio();
  const [cursor, setCursor] = useState(() => dayjs().startOf('month'));
  const [selected, setSelected] = useState<ISODate | null>(null);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [adding, setAdding] = useState(false);

  const dayStats = useMemo(() => computeDayStatsMap(all), [all]);

  const tradesByDay = useMemo(() => {
    const map = new Map<ISODate, Trade[]>();
    for (const trade of all) {
      const key = trade.exitPrice != null ? (trade.exitDate ?? trade.entryDate) : trade.entryDate;
      const list = map.get(key);
      if (list) list.push(trade);
      else map.set(key, [trade]);
    }
    return map;
  }, [all]);

  /** The 6-week grid covering the visible month, Monday-first. */
  const weeks = useMemo(() => {
    const start = cursor.startOf('month').startOf('week').add(1, 'day');
    // dayjs weeks start on Sunday; shift so the grid reads Mon–Sun.
    const gridStart = cursor.startOf('month').day() === 0 ? start.subtract(7, 'day') : start;
    const result: dayjs.Dayjs[][] = [];
    let day = gridStart;
    for (let w = 0; w < 6; w += 1) {
      const week: dayjs.Dayjs[] = [];
      for (let d = 0; d < 7; d += 1) {
        week.push(day);
        day = day.add(1, 'day');
      }
      result.push(week);
    }
    return result;
  }, [cursor]);

  const monthDays = useMemo(() => {
    const prefix = cursor.format('YYYY-MM');
    return [...dayStats.values()].filter((d) => d.date.startsWith(prefix));
  }, [dayStats, cursor]);

  const summary = useMemo(() => summarisePeriod(monthDays), [monthDays]);
  const peak = useMemo(() => peakAbsPnl(monthDays), [monthDays]);

  const selectedTrades = selected ? (tradesByDay.get(selected) ?? []) : [];
  const selectedStats = selected ? dayStats.get(selected) : undefined;

  if (isLoading) return <LoadingState label="Loading your calendar…" />;

  return (
    <>
      <PageHeader title="Calendar" subtitle="Every trading day at a glance — click a day for the detail.">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCursor((c) => c.subtract(1, 'month'))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium text-text">
            {cursor.format('MMMM YYYY')}
          </span>
          <Button variant="outline" size="sm" onClick={() => setCursor((c) => c.add(1, 'month'))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(dayjs().startOf('month'))}>
            Today
          </Button>
        </div>
      </PageHeader>

      {/* 5 across only from xl: at md the cards are too narrow for a figure
          like "-$441.07" and it gets truncated. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label="Month P&L"
          value={formatCompactSignedCurrency(summary.netPnl, currency)}
          title={formatCurrency(summary.netPnl, currency)}
          tone={summary.netPnl > 0 ? 'profit' : summary.netPnl < 0 ? 'loss' : 'neutral'}
          sub={`${summary.closedTrades} closed · ${summary.openTrades} open`}
        />
        <MetricCard
          label="Trading Days"
          value={summary.tradingDays}
          sub={`${summary.winDays}W / ${summary.lossDays}L`}
        />
        <MetricCard
          label="Best Day"
          value={summary.bestDay ? formatCompactCurrency(summary.bestDay.netPnl, currency) : 'N/A'}
          title={summary.bestDay ? formatDate(summary.bestDay.date) : undefined}
          tone="profit"
          sub={summary.bestDay ? formatDate(summary.bestDay.date, 'MMM D') : undefined}
        />
        <MetricCard
          label="Worst Day"
          value={summary.worstDay ? formatCompactCurrency(summary.worstDay.netPnl, currency) : 'N/A'}
          title={summary.worstDay ? formatDate(summary.worstDay.date) : undefined}
          tone="loss"
          sub={summary.worstDay ? formatDate(summary.worstDay.date, 'MMM D') : undefined}
        />
        <MetricCard
          label="Best Streak"
          value={`${summary.longestWinStreak} day${summary.longestWinStreak === 1 ? '' : 's'}`}
          sub={`Worst ${summary.longestLossStreak}`}
          hint="Consecutive profitable trading days"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardBody>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((d) => (
                <div key={d} className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {d}
                </div>
              ))}

              {weeks.flat().map((day) => {
                const iso = day.format('YYYY-MM-DD');
                const stats = dayStats.get(iso);
                const inMonth = day.month() === cursor.month();
                const isToday = iso === dayjs().format('YYYY-MM-DD');
                const isSelected = iso === selected;

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelected(iso)}
                    className={cn(
                      'flex min-h-16 flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left transition-colors',
                      inMonth ? 'border-border' : 'border-transparent opacity-40',
                      stats && heatClass(stats.netPnl, peak),
                      isSelected && 'ring-2 ring-primary',
                      'hover:border-primary/50',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[11px] font-medium',
                        isToday ? 'rounded bg-primary px-1 text-primary-fg' : 'text-muted',
                      )}
                    >
                      {day.date()}
                    </span>
                    {stats && (
                      <>
                        <span
                          className={cn(
                            'w-full truncate text-xs font-semibold tabular',
                            stats.netPnl > 0 ? 'text-profit' : stats.netPnl < 0 ? 'text-loss' : 'text-muted',
                          )}
                        >
                          {formatCompactSignedCurrency(stats.netPnl, currency)}
                        </span>
                        <span className="text-[10px] text-muted">
                          {stats.grossTrades} {stats.grossTrades === 1 ? 'trade' : 'trades'}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-end gap-3 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-loss/25" /> Loss
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded border border-border" /> Flat / no trades
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-profit/25" /> Profit
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Weekly Breakdown" description={cursor.format('MMMM YYYY')} />
          <CardBody className="space-y-2">
            {weeks.map((week, i) => {
              const inMonth = week.filter((d) => d.month() === cursor.month());
              if (inMonth.length === 0) return null;
              const weekStats = week
                .map((d) => dayStats.get(d.format('YYYY-MM-DD')))
                .filter((s): s is DayStats => Boolean(s));
              const net = weekStats.reduce((a, s) => a + s.netPnl, 0);
              const trades = weekStats.reduce((a, s) => a + s.grossTrades, 0);

              return (
                <div
                  key={week[0]?.format('YYYY-MM-DD')}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-text">Week {i + 1}</p>
                    <p className="text-[10px] text-muted">
                      {inMonth[0]?.format('MMM D')} – {inMonth[inMonth.length - 1]?.format('MMM D')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'text-xs font-semibold tabular',
                        net > 0 ? 'text-profit' : net < 0 ? 'text-loss' : 'text-muted',
                      )}
                    >
                      {trades === 0 ? '—' : formatCompactSignedCurrency(net, currency)}
                    </p>
                    <p className="text-[10px] text-muted">{trades} trades</p>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      {/* Day detail */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? formatDate(selected, 'dddd, MMMM D, YYYY') : ''}
        size="lg"
      >
        {selectedStats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard
                label="Net P&L"
                value={formatCompactSignedCurrency(selectedStats.netPnl, currency)}
                title={formatCurrency(selectedStats.netPnl, currency)}
                tone={selectedStats.netPnl > 0 ? 'profit' : selectedStats.netPnl < 0 ? 'loss' : 'neutral'}
              />
              <MetricCard label="Win Rate" value={formatPercent(selectedStats.winRate)} sub={`${selectedStats.wins}W / ${selectedStats.losses}L`} />
              <MetricCard label="Total R" value={formatR(selectedStats.totalR)} tone={(selectedStats.totalR ?? 0) >= 0 ? 'profit' : 'loss'} />
              <MetricCard label="Charges" value={formatCompactCurrency(selectedStats.charges, currency)} title={formatCurrency(selectedStats.charges, currency)} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-2 py-2 font-medium">Symbol</th>
                    <th className="px-2 py-2 font-medium">Side</th>
                    <th className="px-2 py-2 font-medium">Entry</th>
                    <th className="px-2 py-2 font-medium">Exit</th>
                    <th className="px-2 py-2 font-medium">Qty</th>
                    <th className="px-2 py-2 text-right font-medium">Net P&L</th>
                    <th className="px-2 py-2 text-right font-medium">R</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {selectedTrades.map((trade) => (
                    <TradeRow
                      key={trade.id}
                      trade={trade}
                      currency={currency}
                      startingCapital={startingCapital}
                      onEdit={() => setEditing(trade)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAdding(true)}>
                Add a trade for this day
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <EmptyState
              icon={CalendarDays}
              title="No trades on this day"
              message="Nothing was recorded for this date."
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAdding(true)}>
                Add a trade for this day
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit trade" size="xl">
        {editing && <TradeForm trade={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} title="Record a trade" size="xl">
        <TradeForm onDone={() => setAdding(false)} />
      </Modal>
    </>
  );
}

function TradeRow({
  trade,
  currency,
  startingCapital,
  onEdit,
}: {
  trade: Trade;
  currency: string;
  startingCapital: number;
  onEdit: () => void;
}) {
  const deleteTrade = useDeleteTrade();
  const metrics = computeTradeMetrics(trade, { startingCapital });
  const isOpen = metrics.status === 'open';

  const remove = () => {
    deleteTrade.mutate(trade.id, {
      onSuccess: () => toast.success('Trade deleted.'),
      onError: () => toast.error('Could not delete the trade.'),
    });
  };

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-2 py-2">
        <span className="font-medium text-text">{trade.symbol}</span>
        {trade.segment && <span className="ml-1 text-[10px] uppercase text-muted">{trade.segment}</span>}
        {trade.strategyId && <p className="text-[10px] text-muted">{trade.setup}</p>}
      </td>
      <td className="px-2 py-2">
        <Badge tone={trade.direction === 'long' ? 'profit' : 'loss'}>{trade.direction}</Badge>
      </td>
      <td className="px-2 py-2 text-muted">{trade.entryPrice}</td>
      <td className="px-2 py-2 text-muted">{trade.exitPrice ?? '—'}</td>
      <td className="px-2 py-2 text-muted">{trade.quantity}</td>
      <td className="px-2 py-2 text-right">
        {isOpen ? (
          <Badge tone="neutral">Open</Badge>
        ) : (
          <span className={cn('font-semibold tabular', (metrics.netPnl ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
            {formatCurrency(metrics.netPnl, currency)}
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-right text-muted tabular">{formatR(metrics.rMultiple)}</td>
      <td className="px-2 py-2">
        <div className="flex justify-end gap-1">
          <button type="button" onClick={onEdit} className="rounded p-1 text-muted hover:text-text" aria-label="Edit trade">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={remove} className="rounded p-1 text-muted hover:text-loss" aria-label="Delete trade">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
