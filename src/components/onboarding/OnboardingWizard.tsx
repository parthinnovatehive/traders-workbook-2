import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Star } from 'lucide-react';
import type { TradingMode } from '@/types';
import { ACCOUNT_CURRENCIES } from '@/constants/currencies';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { useFavourites, useInstruments, useToggleFavourite } from '@/hooks/useInstruments';
import { useTradingAccounts, useUpdateTradingAccount } from '@/hooks/useTradingAccounts';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

/**
 * First-run wizard.
 *
 * A new account otherwise lands on an empty dashboard with two unfunded books
 * and no indication that either exists — ROI and drawdown read zero because
 * there is no capital base, which looks like a broken app rather than a setup
 * step. Three questions fix that: which market, how much capital in each, and a
 * few instruments starred so the trade form opens on something useful.
 *
 * Skippable at every step: nothing here blocks getting into the product.
 */

const STEPS = ['Market', 'Capital', 'Instruments'] as const;

/**
 * The handful a trader in each market is most likely to want. Filtered against
 * the real catalogue before rendering, so a renamed symbol just drops out.
 */
const SUGGESTED: Record<TradingMode, string[]> = {
  forex: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'XAU/USD', 'GBP/JPY', 'EUR/JPY'],
  indian: ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'SBIN'],
};

export function OnboardingWizard() {
  const user = useAuthStore((s) => s.user);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const setTradingMode = useUiStore((s) => s.setTradingMode);
  const activeMode = useUiStore((s) => s.tradingMode);

  const accounts = useTradingAccounts();
  const updateAccount = useUpdateTradingAccount();

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<TradingMode>(activeMode);
  const [forexCurrency, setForexCurrency] = useState('USD');
  const [forexCapital, setForexCapital] = useState('');
  const [indianCapital, setIndianCapital] = useState('');
  const [saving, setSaving] = useState(false);

  // Only for users who have never been through it. `onboardedAt` is set
  // optimistically on finish, so this closes immediately either way.
  const open = Boolean(user) && !user?.onboardedAt;
  if (!open) return null;

  const finish = async (skipped = false) => {
    setSaving(true);
    try {
      if (!skipped) {
        const forex = Number(forexCapital);
        const indian = Number(indianCapital);
        // Only write what the user actually filled in — a blank field means
        // "later", not zero.
        if (forexCapital.trim() && Number.isFinite(forex)) {
          await updateAccount.mutateAsync({
            tradingMode: 'forex',
            patch: { currency: forexCurrency, startingCapital: Math.max(0, forex) },
          });
        } else if (forexCurrency !== 'USD') {
          await updateAccount.mutateAsync({
            tradingMode: 'forex',
            patch: { currency: forexCurrency },
          });
        }
        if (indianCapital.trim() && Number.isFinite(indian)) {
          await updateAccount.mutateAsync({
            tradingMode: 'indian',
            patch: { startingCapital: Math.max(0, indian) },
          });
        }
      }
      setTradingMode(mode);
      await completeOnboarding();
      if (!skipped) toast.success("You're all set. Record your first trade whenever you're ready.");
    } catch {
      toast.error('Could not save your setup — you can change it any time in Settings.');
      await completeOnboarding();
    } finally {
      setSaving(false);
    }
  };

  const isLast = step === STEPS.length - 1;

  return (
    <Modal
      open
      onClose={() => void finish(true)}
      title={`Set up your workbook — ${STEPS[step]}`}
      description={`Step ${step + 1} of ${STEPS.length}. You can change all of this later in Settings.`}
      size="lg"
    >
      <div className="mb-5 flex gap-1.5">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </div>

      {step === 0 && <MarketStep mode={mode} onChange={setMode} />}

      {step === 1 && (
        <CapitalStep
          forexCurrency={forexCurrency}
          onForexCurrency={setForexCurrency}
          forexCapital={forexCapital}
          onForexCapital={setForexCapital}
          indianCapital={indianCapital}
          onIndianCapital={setIndianCapital}
          loading={accounts.isLoading}
        />
      )}

      {step === 2 && <InstrumentStep mode={mode} />}

      <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={() => void finish(true)} disabled={saving}>
          Skip setup
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {isLast ? (
            <Button loading={saving} onClick={() => void finish(false)}>
              <Check className="h-4 w-4" /> Finish
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MarketStep({
  mode,
  onChange,
}: {
  mode: TradingMode;
  onChange: (m: TradingMode) => void;
}) {
  const OPTIONS: { value: TradingMode; title: string; text: string }[] = [
    {
      value: 'forex',
      title: 'Forex & Metals',
      text: 'Currency pairs, gold and silver, sized in lots. Your account can be in any major currency.',
    },
    {
      value: 'indian',
      title: 'Indian Markets',
      text: 'NSE and BSE equity, futures and index contracts. Always tracked in rupees.',
    },
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Which do you trade most? You get both books either way — this just decides which one opens
        first.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-card border p-4 text-left transition-colors',
              mode === o.value
                ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                : 'border-border hover:border-muted',
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-text">
              {o.title}
              {mode === o.value && <Check className="h-4 w-4 text-primary" />}
            </span>
            <span className="mt-1.5 block text-xs text-muted">{o.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CapitalStep({
  forexCurrency,
  onForexCurrency,
  forexCapital,
  onForexCapital,
  indianCapital,
  onIndianCapital,
  loading,
}: {
  forexCurrency: string;
  onForexCurrency: (v: string) => void;
  forexCapital: string;
  onForexCapital: (v: string) => void;
  indianCapital: string;
  onIndianCapital: (v: string) => void;
  loading: boolean;
}) {
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Starting capital is what ROI and drawdown are measured against. Each book keeps its own, so
        a Forex figure is never compared to an Indian one. Leave either blank to set it later.
      </p>
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <p className="mb-3 text-sm font-medium text-text">Forex account</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency">
              <Select
                value={forexCurrency}
                onChange={(e) => onForexCurrency(e.target.value)}
                disabled={loading}
              >
                {ACCOUNT_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Starting capital">
              <Input
                type="number"
                step="any"
                min="0"
                value={forexCapital}
                onChange={(e) => onForexCapital(e.target.value)}
                placeholder="10000"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <p className="mb-3 text-sm font-medium text-text">Indian account</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency" hint="Always INR">
              <Input value="INR" readOnly disabled className="bg-surface text-muted" />
            </Field>
            <Field label="Starting capital">
              <Input
                type="number"
                step="any"
                min="0"
                value={indianCapital}
                onChange={(e) => onIndianCapital(e.target.value)}
                placeholder="500000"
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Star a few instruments so the trade form's picker opens on something useful. */
function InstrumentStep({ mode }: { mode: TradingMode }) {
  const instruments = useInstruments(mode);
  const favourites = useFavourites();
  const toggle = useToggleFavourite();

  const starred = useMemo(
    () => new Set((favourites.data ?? []).filter((f) => f.tradingMode === mode).map((f) => f.symbol)),
    [favourites.data, mode],
  );

  const options = useMemo(() => {
    const available = new Set((instruments.data ?? []).map((i) => i.symbol));
    const suggested = SUGGESTED[mode].filter((s) => available.has(s));
    // Fall back to the head of the catalogue if the dataset names things differently.
    if (suggested.length > 0) return suggested;
    return (instruments.data ?? []).slice(0, 8).map((i) => i.symbol);
  }, [instruments.data, mode]);

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Star what you trade and it pins to the top of the instrument picker. Optional — you can star
        anything from the trade form later.
      </p>
      {instruments.isLoading ? (
        <p className="py-6 text-center text-sm text-muted">Loading instruments…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((symbol) => {
            const on = starred.has(symbol);
            return (
              <button
                key={symbol}
                type="button"
                aria-pressed={on}
                onClick={() => toggle.mutate({ tradingMode: mode, symbol, isFavourite: on })}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  on
                    ? 'border-primary bg-primary/10 text-text'
                    : 'border-border text-muted hover:text-text',
                )}
              >
                <Star className={cn('h-3.5 w-3.5', on && 'fill-warning text-warning')} />
                {symbol}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
