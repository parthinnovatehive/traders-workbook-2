import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, BookOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Trade } from '@/types';
import { computeTradeMetrics } from '@/calculations';
import { Badge, Button, Card, EmptyState, Input, LoadingState, Modal, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { TradeForm } from '@/components/forms/TradeForm';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { useEntitlements } from '@/hooks/useBilling';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useStrategies } from '@/hooks/useStrategies';
import { useDeleteTrade } from '@/hooks/useTrades';
import { toast } from '@/store/toastStore';
import { formatCurrency, formatR } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';

type SortKey = 'date' | 'symbol' | 'netPnl' | 'rMultiple';
const PAGE_SIZE = 12;

interface Row {
  trade: Trade;
  netPnl: number | null;
  rMultiple: number | null;
  status: 'open' | 'closed';
  outcome: 'win' | 'loss' | 'breakeven' | null;
}

export default function Journal() {
  // The mode's OWN account supplies the currency and capital base. Reading the
  // legacy profile fields here rendered Indian trades with a dollar sign while
  // every other page showed the same P&L in rupees.
  const { all, startingCapital, currency, isLoading } = usePortfolio();
  const strategiesQuery = useStrategies();
  const deleteTrade = useDeleteTrade();

  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [outcome, setOutcome] = useState('');
  const [strategy, setStrategy] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState<Trade | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { entitlements } = useEntitlements();

  const openAdd = () => {
    if (entitlements.canCreateTrade) setAddOpen(true);
    else setUpgradeOpen(true);
  };

  const strategyName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of strategiesQuery.data ?? []) map.set(s.id, s.name);
    return (id: string | null) => (id ? (map.get(id) ?? '—') : '—');
  }, [strategiesQuery.data]);

  const rows = useMemo<Row[]>(
    () =>
      all.map((trade) => {
        const met = computeTradeMetrics(trade, { startingCapital });
        return {
          trade,
          netPnl: met.netPnl,
          rMultiple: met.rMultiple,
          status: met.status,
          outcome: met.outcome,
        };
      }),
    [all, startingCapital],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.trade.symbol.toLowerCase().includes(q)) return false;
      if (direction && r.trade.direction !== direction) return false;
      if (strategy && r.trade.strategyId !== strategy) return false;
      if (outcome) {
        if (outcome === 'open' && r.status !== 'open') return false;
        if (outcome !== 'open' && r.outcome !== outcome) return false;
      }
      return true;
    });
  }, [rows, search, direction, strategy, outcome]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return filtered.toSorted((a, b) => {
      switch (sortKey) {
        case 'symbol':
          return a.trade.symbol.localeCompare(b.trade.symbol) * dir;
        case 'netPnl':
          return ((a.netPnl ?? 0) - (b.netPnl ?? 0)) * dir;
        case 'rMultiple':
          return ((a.rMultiple ?? 0) - (b.rMultiple ?? 0)) * dir;
        default:
          return `${a.trade.entryDate}${a.trade.entryTime ?? ''}`.localeCompare(
            `${b.trade.entryDate}${b.trade.entryTime ?? ''}`,
          ) * dir;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteTrade.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Trade deleted.');
        setDeleting(null);
      },
      onError: () => toast.error('Could not delete trade.'),
    });
  };

  if (isLoading) return <LoadingState label="Loading trades…" />;

  return (
    <>
      <PageHeader
        title="Trade Journal"
        subtitle={`${rows.length} trades recorded`}
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Trade
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search symbol…"
              className="pl-9"
            />
          </div>
          <Select value={direction} onChange={(e) => setDirection(e.target.value)} className="w-auto">
            <option value="">All directions</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </Select>
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-auto">
            <option value="">All outcomes</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="breakeven">Breakeven</option>
            <option value="open">Open</option>
          </Select>
          <Select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="w-auto">
            <option value="">All strategies</option>
            {(strategiesQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {sorted.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={rows.length === 0 ? 'No trades yet' : 'No trades match your filters'}
            message={rows.length === 0 ? 'Record your first trade to start building your performance history.' : undefined}
            action={rows.length === 0 ? <Button onClick={openAdd}>Add your first trade</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <Th onClick={() => toggleSort('date')}>Date</Th>
                  <Th onClick={() => toggleSort('symbol')}>Symbol</Th>
                  <th className="px-3 py-2.5 font-medium">Dir</th>
                  <th className="px-3 py-2.5 text-right font-medium">Entry</th>
                  <th className="px-3 py-2.5 text-right font-medium">Exit</th>
                  <Th onClick={() => toggleSort('netPnl')} className="text-right">Net P&L</Th>
                  <Th onClick={() => toggleSort('rMultiple')} className="text-right">R</Th>
                  <th className="px-3 py-2.5 font-medium">Strategy</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ trade, netPnl, rMultiple, status }) => (
                  <tr key={trade.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted">{formatDate(trade.entryDate, 'MMM D')}</td>
                    <td className="px-3 py-2.5 font-medium text-text">{trade.symbol}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={trade.direction === 'long' ? 'profit' : 'loss'}>{trade.direction}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-text">{trade.entryPrice}</td>
                    <td className="px-3 py-2.5 text-right tabular text-muted">{trade.exitPrice ?? '—'}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular font-medium', netPnl == null ? 'text-muted' : netPnl > 0 ? 'text-profit' : netPnl < 0 ? 'text-loss' : 'text-text')}>
                      {netPnl == null ? '—' : formatCurrency(netPnl, currency)}
                    </td>
                    <td className={cn('px-3 py-2.5 text-right tabular', (rMultiple ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                      {rMultiple == null ? 'N/A' : formatR(rMultiple)}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{strategyName(trade.strategyId)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={status === 'open' ? 'warning' : 'neutral'}>{status}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" aria-label="Edit" onClick={() => setEditing(trade)} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" aria-label="Delete" onClick={() => setDeleting(trade)} className="rounded p-1.5 text-muted hover:bg-loss/10 hover:text-loss">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {sorted.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>
            Page {safePage + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Trade" description="Record a new trade." size="xl">
        <TradeForm variant="full" onDone={() => setAddOpen(false)} />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Trade" size="xl">
        {editing && <TradeForm variant="full" trade={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete trade?" size="md">
        <p className="text-sm text-muted">
          This will permanently remove the {deleting?.symbol} trade from your journal. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteTrade.isPending} onClick={confirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Th({ children, onClick, className }: { children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <th className={cn('px-3 py-2.5 font-medium', className)}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-text">
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}
