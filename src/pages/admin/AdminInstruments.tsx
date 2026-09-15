import { useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import type { Instrument, TradingMode } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  LoadingState,
  Modal,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { useInstruments } from '@/hooks/useInstruments';
import { useUpdateInstrument } from '@/hooks/useAdmin';
import { LOT_SIZES_AS_OF } from '@/constants/indianInstruments';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

export default function AdminInstruments() {
  const [mode, setMode] = useState<TradingMode>('indian');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Instrument | null>(null);
  const instruments = useInstruments(mode);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (instruments.data ?? []).filter(
      (i) => !q || i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
    );
  }, [instruments.data, query]);

  return (
    <>
      <PageHeader
        title="Instruments"
        subtitle="Correct a contract specification without a redeploy."
      />

      <Card className="mb-4">
        <CardBody className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-muted">
            NSE and BSE revise F&amp;O and index lot sizes several times a year. The bundled values
            were reconciled as of <span className="font-medium text-text">{LOT_SIZES_AS_OF}</span>.
            Check them against the current exchange circular and correct them here — changes take
            effect immediately for every user. Traders can also override the lot size on an
            individual trade.
          </p>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardBody className="flex flex-wrap items-center gap-3 border-b border-border">
          <div className="flex overflow-hidden rounded-lg border border-border">
            {(['indian', 'forex'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  mode === m ? 'bg-primary text-primary-fg' : 'text-muted hover:text-text',
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or name…"
              className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            />
          </div>
          <span className="text-xs text-muted">{rows.length} instruments</span>
        </CardBody>

        {instruments.isLoading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title="No instruments match" />
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Symbol</th>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Where</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {mode === 'forex' ? 'Contract' : 'Lot size'}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {mode === 'forex' ? 'Pip' : 'Tick'}
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 font-medium text-text">{i.symbol}</td>
                    <td className="px-3 py-2 text-muted">{i.name}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {i.exchange
                        ? [i.exchange, ...i.alsoOn].join(' · ')
                        : (i.category ?? '—')}
                      {i.hasFno && (
                        <Badge tone="primary" className="ml-1.5">
                          F&O
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-text">
                      {(mode === 'forex' ? i.contractSize : i.lotSize).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-muted">
                      {mode === 'forex' ? (i.pipSize ?? '—') : i.tickSize}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditing(i)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.symbol ?? ''}
        description={editing?.name}
      >
        {editing && <EditInstrument instrument={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function EditInstrument({ instrument, onDone }: { instrument: Instrument; onDone: () => void }) {
  const update = useUpdateInstrument();
  const [lotSize, setLotSize] = useState(String(instrument.lotSize));
  const [contractSize, setContractSize] = useState(String(instrument.contractSize));
  const [tickSize, setTickSize] = useState(String(instrument.tickSize));
  const [pipSize, setPipSize] = useState(instrument.pipSize != null ? String(instrument.pipSize) : '');
  const [isActive, setIsActive] = useState(instrument.isActive);

  const isForex = instrument.tradingMode === 'forex';

  const save = () => {
    update.mutate(
      {
        id: instrument.id,
        patch: {
          lotSize: Number(lotSize) || instrument.lotSize,
          contractSize: Number(contractSize) || instrument.contractSize,
          tickSize: Number(tickSize) || instrument.tickSize,
          pipSize: pipSize === '' ? undefined : Number(pipSize),
          isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${instrument.symbol} updated.`);
          onDone();
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not update the instrument.'),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {isForex ? (
          <>
            <Field label="Contract size" hint="Units in one standard lot">
              <Input type="number" step="any" value={contractSize} onChange={(e) => setContractSize(e.target.value)} />
            </Field>
            <Field label="Pip size">
              <Input type="number" step="any" value={pipSize} onChange={(e) => setPipSize(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Lot size" hint="F&O contract multiplier">
              <Input type="number" step="any" value={lotSize} onChange={(e) => setLotSize(e.target.value)} />
            </Field>
            <Field label="Tick size">
              <Input type="number" step="any" value={tickSize} onChange={(e) => setTickSize(e.target.value)} />
            </Field>
          </>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="accent-primary"
        />
        Available to traders
      </label>

      <p className="text-xs text-muted">
        Changing a lot size affects how NEW trades are sized. Trades already recorded keep the lot
        size captured at entry, so past P&amp;L does not silently change.
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} loading={update.isPending}>
          Save
        </Button>
      </div>
    </div>
  );
}
