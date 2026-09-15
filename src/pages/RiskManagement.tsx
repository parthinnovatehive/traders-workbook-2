import { useMemo, useState } from 'react';
import { ShieldAlert, TriangleAlert } from 'lucide-react';
import type { RiskWarning, TradingMode } from '@/types';
import { closedTradesInOrder, computeAccountMetrics, initialRisk } from '@/calculations';
import { Button, Card, CardBody, CardHeader, Field, Input, LoadingState, MetricCard } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { FeatureGate } from '@/components/billing/FeatureGate';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useRiskSetting, useUpdateRiskSetting } from '@/hooks/useRisk';
import { filterTradesByRange } from '@/hooks/useDateFilter';
import { resolvePreset } from '@/utils/date';
import { useUiStore } from '@/store/uiStore';
import { toast } from '@/store/toastStore';
import { formatCurrency, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

const MODE_LABELS: Record<TradingMode, string> = { forex: 'Forex', indian: 'Indian' };

export default function RiskManagement() {
  const tradingMode = useUiStore((s) => s.tradingMode);
  return (
    <FeatureGate
      feature="advanced_risk"
      title="Unlock Risk Management"
      description="Upgrade to Pro for per-book risk rules, live limit monitoring and the position size calculator."
    >
      {/* Keyed on the mode so switching books remounts with that book's rules,
          instead of leaving a half-edited draft from the other one on screen. */}
      <RiskManagementInner key={tradingMode} />
    </FeatureGate>
  );
}

function RiskManagementInner() {
  const { all, startingCapital, currency, tradingMode, isLoading } = usePortfolio();
  // Rules belong to the active book: a daily loss limit is an amount in THIS
  // account's currency, so switching modes loads that book's own rules rather
  // than re-labelling one global number with a different symbol.
  const riskQuery = useRiskSetting(tradingMode);
  const updateRisk = useUpdateRiskSetting(tradingMode);

  const setting = riskQuery.data;
  const [draft, setDraft] = useState<{ riskPerTradePct: string; dailyLossLimit: string; maxDrawdownPct: string; maxPositionPct: string } | null>(
    null,
  );
  const form = draft ?? {
    riskPerTradePct: String(setting?.riskPerTradePct ?? 1),
    dailyLossLimit: String(setting?.dailyLossLimit ?? 1000),
    maxDrawdownPct: String(setting?.maxDrawdownPct ?? 15),
    maxPositionPct: String(setting?.maxPositionPct ?? 25),
  };

  const allMetrics = useMemo(() => computeAccountMetrics(all, startingCapital), [all, startingCapital]);
  const todayNet = useMemo(
    () => computeAccountMetrics(filterTradesByRange(all, resolvePreset('today')), startingCapital).netPnl,
    [all, startingCapital],
  );
  const avgRisk = useMemo(() => {
    const risks = closedTradesInOrder(all)
      .map((t) => initialRisk(t))
      .filter((r): r is number => r !== null);
    return risks.length ? risks.reduce((a, b) => a + b, 0) / risks.length : null;
  }, [all]);

  const capital = allMetrics.endingCapital;
  const riskPerTradeAmt = (capital * Number(form.riskPerTradePct)) / 100;
  const maxPositionValue = (capital * Number(form.maxPositionPct)) / 100;

  const warnings = useMemo<RiskWarning[]>(() => {
    const list: RiskWarning[] = [];
    if (setting) {
      if (todayNet <= -setting.dailyLossLimit && setting.dailyLossLimit > 0) {
        list.push({ code: 'DAILY_LOSS_LIMIT_REACHED', severity: 'danger', message: `Daily loss limit reached — today's loss ${formatCurrency(todayNet, currency)} exceeds your ${formatCurrency(-setting.dailyLossLimit, currency)} limit.` });
      }
      if (allMetrics.maxDrawdownPct != null && allMetrics.maxDrawdownPct >= setting.maxDrawdownPct) {
        list.push({ code: 'MAX_DRAWDOWN_EXCEEDED', severity: 'danger', message: `Maximum drawdown of ${formatPercent(allMetrics.maxDrawdownPct)} has reached your ${setting.maxDrawdownPct}% limit.` });
      }
      if (avgRisk != null && avgRisk > riskPerTradeAmt * 1.25) {
        list.push({ code: 'RISK_PER_TRADE_EXCEEDED', severity: 'warning', message: `Your average risk ${formatCurrency(avgRisk, currency)} exceeds your target of ${formatCurrency(riskPerTradeAmt, currency)} per trade.` });
      }
    }
    return list;
  }, [setting, todayNet, allMetrics.maxDrawdownPct, avgRisk, riskPerTradeAmt, currency]);

  const save = () => {
    updateRisk.mutate(
      {
        riskPerTradePct: Number(form.riskPerTradePct),
        dailyLossLimit: Number(form.dailyLossLimit),
        maxDrawdownPct: Number(form.maxDrawdownPct),
        maxPositionPct: Number(form.maxPositionPct),
      },
      {
        onSuccess: () => {
          toast.success('Risk rules updated.');
          setDraft(null);
        },
        onError: () => toast.error('Could not save risk rules.'),
      },
    );
  };

  if (isLoading || riskQuery.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Risk Management"
        subtitle={`Rules for your ${MODE_LABELS[tradingMode]} book, in ${currency}. Each book has its own.`}
      />

      {warnings.length > 0 && (
        <div className="mb-5 space-y-2">
          {warnings.map((w) => (
            <div
              key={w.code}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
                w.severity === 'danger' ? 'border-loss/40 bg-loss/10 text-loss' : 'border-warning/40 bg-warning/10 text-warning',
              )}
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-text">{w.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Starting Capital" value={formatCurrency(startingCapital, currency)} />
        <MetricCard label="Current Capital" value={formatCurrency(capital, currency)} tone={capital >= startingCapital ? 'profit' : 'loss'} />
        <MetricCard label="Risk / Trade" value={formatCurrency(riskPerTradeAmt, currency)} sub={`${form.riskPerTradePct}% of capital`} />
        <MetricCard label="Daily Loss Limit" value={formatCurrency(Number(form.dailyLossLimit), currency)} />
        <MetricCard label="Max Position" value={formatCurrency(maxPositionValue, currency)} sub={`${form.maxPositionPct}% of capital`} />
        <MetricCard label="Max Drawdown" value={allMetrics.maxDrawdown === 0 ? formatCurrency(0, currency) : `-${formatCurrency(allMetrics.maxDrawdown, currency)}`} tone={allMetrics.maxDrawdown > 0 ? 'loss' : 'neutral'} sub={formatPercent(allMetrics.maxDrawdownPct)} />
        <MetricCard label="Average Risk" value={avgRisk == null ? 'N/A' : formatCurrency(avgRisk, currency)} />
        <MetricCard label="Average R" value={allMetrics.averageR == null ? 'N/A' : `${allMetrics.averageR.toFixed(2)}R`} tone={(allMetrics.averageR ?? 0) >= 0 ? 'profit' : 'loss'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Risk Rules"
            description={`Applied to your ${MODE_LABELS[tradingMode]} book only`}
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Risk per trade (%)">
                <Input type="number" step="any" value={form.riskPerTradePct} onChange={(e) => setDraft({ ...form, riskPerTradePct: e.target.value })} />
              </Field>
              <Field label={`Daily loss limit (${currency})`}>
                <Input type="number" step="any" value={form.dailyLossLimit} onChange={(e) => setDraft({ ...form, dailyLossLimit: e.target.value })} />
              </Field>
              <Field label="Max drawdown (%)">
                <Input type="number" step="any" value={form.maxDrawdownPct} onChange={(e) => setDraft({ ...form, maxDrawdownPct: e.target.value })} />
              </Field>
              <Field label="Max position (%)">
                <Input type="number" step="any" value={form.maxPositionPct} onChange={(e) => setDraft({ ...form, maxPositionPct: e.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              {draft && (
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Reset
                </Button>
              )}
              <Button loading={updateRisk.isPending} disabled={!draft} onClick={save}>
                Save rules
              </Button>
            </div>
          </CardBody>
        </Card>

        <PositionCalculator capital={capital} currency={currency} defaultRiskPct={Number(form.riskPerTradePct)} />
      </div>
    </>
  );
}

function PositionCalculator({ capital, currency, defaultRiskPct }: { capital: number; currency: string; defaultRiskPct: number }) {
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [riskPct, setRiskPct] = useState(String(defaultRiskPct));

  const riskAmount = (capital * Number(riskPct)) / 100;
  const distance = Math.abs(Number(entry) - Number(stop));
  const qty = distance > 0 && Number.isFinite(distance) ? riskAmount / distance : null;

  return (
    <Card>
      <CardHeader title="Position Size Calculator" description="Size a position from your risk budget" />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Entry">
            <Input type="number" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} />
          </Field>
          <Field label="Stop Loss">
            <Input type="number" step="any" value={stop} onChange={(e) => setStop(e.target.value)} />
          </Field>
          <Field label="Risk %">
            <Input type="number" step="any" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-2 p-4">
          <div>
            <p className="text-xs text-muted">Risk amount</p>
            <p className="mt-0.5 text-lg font-semibold tabular text-text">{formatCurrency(riskAmount, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Suggested position size</p>
            <p className="mt-0.5 text-lg font-semibold tabular text-primary">
              {qty == null ? 'N/A' : Math.floor(qty).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <ShieldAlert className="h-3.5 w-3.5" />
          Enter and stop must differ to compute a size.
        </div>
      </CardBody>
    </Card>
  );
}
