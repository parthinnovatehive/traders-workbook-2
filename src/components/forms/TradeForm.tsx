import { useMemo, useState, type ReactNode } from 'react';
import type { Market, MistakeCode, PsychCode, Trade, TradeDirection, TradeDraft, TradingMode } from '@/types';
import { MISTAKE_CODES, MISTAKE_LABELS, PSYCH_CODES, PSYCH_LABELS } from '@/constants/journal';
import {
  FOREX_PAIRS,
  getForexSpec,
  LOT_TYPES,
  LOT_TYPE_LABELS,
  LOT_UNITS,
  type LotType,
} from '@/constants/instruments';
import { getIndianSpec, INDIAN_INSTRUMENTS } from '@/constants/indianInstruments';
import { ACCOUNT_CURRENCIES } from '@/constants/currencies';
import {
  calculateForexPipValue,
  calculateLotSize,
  calculatePipDistance,
  computeTradeMetrics,
} from '@/calculations';
import { getFxProvider } from '@/services/fx';
import { tradeSchema } from '@/schemas/trade';
import { TradeLimitError } from '@/services';
import { useCreateTrade, useUpdateTrade } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { toast } from '@/store/toastStore';
import { todayISO } from '@/utils/date';
import { formatCurrency, formatR } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';

interface FormState {
  symbol: string;
  direction: TradeDirection;
  accountCurrency: string;
  lotType: LotType;
  riskPct: string;
  entryDate: string;
  entryTime: string;
  exitDate: string;
  exitTime: string;
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  stopLoss: string;
  target: string;
  charges: string;
  strategyId: string;
  setup: string;
  marketCondition: string;
  notes: string;
  psychology: PsychCode[];
  mistakes: MistakeCode[];
}

const num = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function initialState(trade: Trade | undefined, mode: TradingMode, defaultCcy: string): FormState {
  return {
    symbol: trade?.symbol ?? (mode === 'forex' ? 'EUR/USD' : 'NIFTY'),
    direction: trade?.direction ?? 'long',
    accountCurrency: trade?.accountCurrency ?? defaultCcy,
    lotType: (trade?.lotType as LotType) ?? 'standard',
    riskPct: '1',
    entryDate: trade?.entryDate ?? todayISO(),
    entryTime: trade?.entryTime ?? '',
    exitDate: trade?.exitDate ?? '',
    exitTime: trade?.exitTime ?? '',
    entryPrice: trade?.entryPrice != null ? String(trade.entryPrice) : '',
    exitPrice: trade?.exitPrice != null ? String(trade.exitPrice) : '',
    quantity: trade?.quantity != null ? String(trade.quantity) : '',
    stopLoss: trade?.stopLoss != null ? String(trade.stopLoss) : '',
    target: trade?.target != null ? String(trade.target) : '',
    charges: trade?.charges != null ? String(trade.charges) : '0',
    strategyId: trade?.strategyId ?? '',
    setup: trade?.setup ?? '',
    marketCondition: trade?.marketCondition ?? '',
    notes: trade?.notes ?? '',
    psychology: trade?.psychology ?? [],
    mistakes: trade?.mistakes ?? [],
  };
}

interface Props {
  trade?: Trade;
  variant?: 'full' | 'quick';
  onDone: () => void;
}

export function TradeForm({ trade, variant = 'full', onDone }: Props) {
  const storeMode = useUiStore((s) => s.tradingMode);
  const mode: TradingMode = trade?.tradingMode ?? storeMode;
  const user = useAuthStore((s) => s.user);
  const defaultCcy = user?.baseCurrency ?? 'USD';

  const [form, setForm] = useState<FormState>(() => initialState(trade, mode, defaultCcy));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const strategies = useStrategies();
  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  const isFull = variant === 'full';
  const isForex = mode === 'forex';

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** Instrument-derived values (specs + FX conversion). */
  const derived = useMemo(() => {
    const fx = getFxProvider();
    if (isForex) {
      const spec = getForexSpec(form.symbol);
      const lotSize = LOT_UNITS[form.lotType] ?? LOT_UNITS.standard;
      const quote = spec?.quote ?? 'USD';
      const base = spec?.base;
      const pipSize = spec?.pipSize ?? 0.0001;
      const conversionRate = fx.getRate(quote, form.accountCurrency);
      return { lotSize, quote, base, pipSize, conversionRate, market: 'Forex' as Market, exchange: undefined, segment: undefined };
    }
    const spec = getIndianSpec(form.symbol);
    const lotSize = spec?.lotSize ?? 1;
    const conversionRate = fx.getRate('INR', form.accountCurrency);
    const market: Market = spec?.segment === 'INDEX' ? 'Index' : spec?.segment === 'EQ' ? 'Equity' : 'Futures';
    return { lotSize, quote: 'INR', base: undefined, pipSize: spec?.tickSize ?? 0.05, conversionRate, market, exchange: spec?.exchange, segment: spec?.segment };
  }, [isForex, form.symbol, form.lotType, form.accountCurrency]);

  const entry = num(form.entryPrice);
  const stop = num(form.stopLoss);
  const qty = num(form.quantity);

  const metrics = useMemo(
    () =>
      computeTradeMetrics(
        {
          direction: form.direction,
          entryPrice: entry ?? Number.NaN,
          exitPrice: num(form.exitPrice),
          quantity: qty ?? Number.NaN,
          lotSize: derived.lotSize,
          stopLoss: stop,
          target: num(form.target),
          charges: num(form.charges) ?? 0,
          conversionRate: derived.conversionRate,
        },
        { startingCapital: user?.startingCapital },
      ),
    [form, entry, stop, qty, derived, user?.startingCapital],
  );

  const positionSize = qty != null && qty > 0 ? qty * derived.lotSize : null;
  const pipDistance = isForex && entry != null && stop != null ? calculatePipDistance(entry, stop, derived.pipSize) : null;
  const pipValue = isForex && positionSize != null ? calculateForexPipValue(derived.pipSize, positionSize, derived.conversionRate) : null;
  const suggestedLots = useMemo(() => {
    if (!isForex) return null;
    const riskPct = num(form.riskPct);
    if (!riskPct || !user?.startingCapital || pipDistance == null || pipDistance <= 0) return null;
    return calculateLotSize({
      riskAmount: (user.startingCapital * riskPct) / 100,
      stopPips: pipDistance,
      pipSize: derived.pipSize,
      unitsPerLot: derived.lotSize,
      quoteToAccountRate: derived.conversionRate,
    });
  }, [isForex, form.riskPct, user?.startingCapital, pipDistance, derived]);

  const ccy = form.accountCurrency;

  const submit = () => {
    const parsed = tradeSchema.safeParse({
      symbol: form.symbol,
      market: derived.market,
      direction: form.direction,
      entryDate: form.entryDate,
      entryTime: form.entryTime || undefined,
      exitDate: form.exitDate || undefined,
      exitTime: form.exitTime || undefined,
      entryPrice: entry ?? Number.NaN,
      exitPrice: num(form.exitPrice),
      quantity: qty ?? Number.NaN,
      stopLoss: stop,
      target: num(form.target),
      charges: num(form.charges) ?? 0,
      strategyId: form.strategyId || null,
      setup: form.setup || undefined,
      marketCondition: form.marketCondition || undefined,
      notes: form.notes || undefined,
      psychology: form.psychology,
      mistakes: form.mistakes,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error('Please fix the highlighted fields.');
      return;
    }

    const v = parsed.data;
    const draft: TradeDraft = {
      tradingMode: mode,
      symbol: isForex ? v.symbol.toUpperCase() : v.symbol.toUpperCase(),
      market: v.market,
      direction: v.direction,
      baseCurrency: derived.base,
      quoteCurrency: derived.quote,
      lotType: isForex ? form.lotType : undefined,
      exchange: derived.exchange,
      segment: derived.segment,
      accountCurrency: form.accountCurrency,
      entryDate: v.entryDate,
      entryTime: v.entryTime,
      exitDate: v.exitPrice != null ? (v.exitDate ?? v.entryDate) : v.exitDate,
      exitTime: v.exitTime,
      entryPrice: v.entryPrice,
      exitPrice: v.exitPrice,
      quantity: v.quantity,
      lotSize: derived.lotSize,
      stopLoss: v.stopLoss,
      target: v.target,
      charges: v.charges,
      conversionRate: derived.conversionRate,
      pipDistance: pipDistance ?? undefined,
      pipValue: pipValue ?? undefined,
      strategyId: v.strategyId,
      setup: v.setup,
      marketCondition: v.marketCondition,
      notes: v.notes,
      psychology: v.psychology,
      mistakes: v.mistakes,
    };

    setErrors({});
    const onError = (e: unknown) => {
      if (e instanceof TradeLimitError) {
        toast.error(e.message);
        onDone();
        return;
      }
      toast.error(e instanceof Error ? e.message : 'Could not save trade.');
    };

    if (trade) {
      updateTrade.mutate(
        { id: trade.id, patch: draft },
        { onSuccess: () => { toast.success('Trade updated.'); onDone(); }, onError },
      );
    } else {
      createTrade.mutate(draft, {
        onSuccess: () => { toast.success('Trade recorded.'); onDone(); },
        onError,
      });
    }
  };

  const saving = createTrade.isPending || updateTrade.isPending;
  const priceHint = isForex ? `Price in ${derived.quote}` : 'Price in ₹';

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-5">
      {/* Instrument row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {isForex ? (
          <Field label="Currency Pair" required error={errors.symbol} className="col-span-2">
            <Input
              value={form.symbol}
              onChange={(e) => set('symbol', e.target.value.toUpperCase())}
              placeholder="EUR/USD"
              list="fx-pairs"
              autoFocus
            />
            <datalist id="fx-pairs">
              {FOREX_PAIRS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
        ) : (
          <Field label="Instrument" required error={errors.symbol} className="col-span-2">
            <Select value={form.symbol} onChange={(e) => set('symbol', e.target.value)}>
              {INDIAN_INSTRUMENTS.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} — {i.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Direction">
          <div className="flex overflow-hidden rounded-lg border border-border">
            {(['long', 'short'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set('direction', d)}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold capitalize transition-colors',
                  form.direction === d
                    ? d === 'long' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
                    : 'bg-bg text-muted hover:text-text',
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Account Currency">
          <Select value={form.accountCurrency} onChange={(e) => set('accountCurrency', e.target.value)}>
            {ACCOUNT_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Forex meta row / Indian meta row */}
      {isForex ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Lot Type">
            <Select value={form.lotType} onChange={(e) => set('lotType', e.target.value as LotType)}>
              {LOT_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {LOT_TYPE_LABELS[lt]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity (Lots)" required error={errors.quantity}>
            <Input type="number" step="any" inputMode="decimal" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
          <Field label="Risk %" hint="For suggested lot size">
            <Input type="number" step="any" value={form.riskPct} onChange={(e) => set('riskPct', e.target.value)} />
          </Field>
          <Field label="Lot Size (units)">
            <Input value={derived.lotSize.toLocaleString()} readOnly className="bg-surface-2 text-muted" />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Exchange">
            <Input value={derived.exchange ?? '—'} readOnly className="bg-surface-2 text-muted" />
          </Field>
          <Field label="Segment">
            <Input value={derived.segment ?? '—'} readOnly className="bg-surface-2 text-muted" />
          </Field>
          <Field label="Quantity (Lots)" required error={errors.quantity}>
            <Input type="number" step="any" inputMode="decimal" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
          <Field label="Lot Size">
            <Input value={derived.lotSize.toLocaleString()} readOnly className="bg-surface-2 text-muted" />
          </Field>
        </div>
      )}

      {/* Prices */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Entry" required error={errors.entryPrice} hint={priceHint}>
          <Input type="number" step="any" inputMode="decimal" value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} />
        </Field>
        <Field label="Exit" hint="Blank if open" error={errors.exitPrice}>
          <Input type="number" step="any" inputMode="decimal" value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} />
        </Field>
        <Field label="Stop Loss" error={errors.stopLoss}>
          <Input type="number" step="any" inputMode="decimal" value={form.stopLoss} onChange={(e) => set('stopLoss', e.target.value)} />
        </Field>
        <Field label={isForex ? 'Take Profit' : 'Target'} error={errors.target}>
          <Input type="number" step="any" inputMode="decimal" value={form.target} onChange={(e) => set('target', e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Charges" hint={ccy} error={errors.charges}>
          <Input type="number" step="any" inputMode="decimal" value={form.charges} onChange={(e) => set('charges', e.target.value)} />
        </Field>
        <Field label="Strategy">
          <Select value={form.strategyId} onChange={(e) => set('strategyId', e.target.value)}>
            <option value="">— None —</option>
            {(strategies.data ?? []).filter((s) => s.isActive).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Entry Date" required error={errors.entryDate}>
          <Input type="date" value={form.entryDate} onChange={(e) => set('entryDate', e.target.value)} />
        </Field>
        {isFull && (
          <Field label="Exit Date">
            <Input type="date" value={form.exitDate} onChange={(e) => set('exitDate', e.target.value)} />
          </Field>
        )}
      </div>

      {isFull && (
        <>
          <Field label="Setup">
            <Input value={form.setup} onChange={(e) => set('setup', e.target.value)} placeholder="Break & retest…" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Psychology</p>
              <div className="flex flex-wrap gap-1.5">
                {PSYCH_CODES.map((code) => (
                  <Chip key={code} active={form.psychology.includes(code)} onClick={() => set('psychology', toggle(form.psychology, code))}>
                    {PSYCH_LABELS[code]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Mistakes</p>
              <div className="flex flex-wrap gap-1.5">
                {MISTAKE_CODES.map((code) => (
                  <Chip key={code} tone="loss" active={form.mistakes.includes(code)} onClick={() => set('mistakes', toggle(form.mistakes, code))}>
                    {MISTAKE_LABELS[code]}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="What was the thesis? What happened?" />
          </Field>
        </>
      )}

      {/* Read-only calculated summary (system-generated) */}
      <div className="rounded-lg border border-border bg-surface-2 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Calculated — read only ({ccy})
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Summary label="Position Size" value={positionSize == null ? 'N/A' : positionSize.toLocaleString()} />
          {isForex && <Summary label="Pip Distance" value={pipDistance == null ? 'N/A' : `${pipDistance}`} />}
          {isForex && <Summary label="Pip Value" value={pipValue == null ? 'N/A' : formatCurrency(pipValue, ccy)} />}
          <Summary label="Risk" value={metrics.risk == null ? 'N/A' : formatCurrency(metrics.risk, ccy)} />
          <Summary label="Reward" value={metrics.reward == null ? 'N/A' : formatCurrency(metrics.reward, ccy)} />
          <Summary label="R:R" value={metrics.riskReward == null ? 'N/A' : metrics.riskReward.toFixed(2)} />
          <Summary label="Gross P&L" value={metrics.grossPnl == null ? 'N/A' : formatCurrency(metrics.grossPnl, ccy)} tone={metrics.grossPnl} />
          <Summary label="Net P&L" value={metrics.netPnl == null ? 'N/A' : formatCurrency(metrics.netPnl, ccy)} tone={metrics.netPnl} />
          <Summary label="R Multiple" value={formatR(metrics.rMultiple)} tone={metrics.rMultiple} />
          <Summary label="ROI" value={metrics.roi == null ? 'N/A' : `${metrics.roi.toFixed(2)}%`} tone={metrics.roi} />
          {isForex && <Summary label="Suggested Lots" value={suggestedLots == null ? 'N/A' : suggestedLots.toFixed(2)} />}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={saving}>{trade ? 'Save changes' : 'Record trade'}</Button>
      </div>
    </form>
  );
}

function Chip({ active, onClick, children, tone = 'primary' }: { active: boolean; onClick: () => void; children: ReactNode; tone?: 'primary' | 'loss' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? tone === 'loss' ? 'border-loss/40 bg-loss/15 text-loss' : 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border bg-bg text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  const color = tone == null || tone === 0 ? 'text-text' : tone > 0 ? 'text-profit' : 'text-loss';
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('mt-0.5 text-sm font-semibold tabular', color)}>{value}</p>
    </div>
  );
}
