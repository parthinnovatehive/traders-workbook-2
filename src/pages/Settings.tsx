import { useState } from 'react';

import {
  AlertTriangle,
  Download,
  MessageSquarePlus,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
} from 'lucide-react';
import type { TradingAccount, TradingMode } from '@/types';
import { FEEDBACK_STATUS_LABELS } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  LoadingState,
  Modal,
  Select,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';

import { ACCOUNT_CURRENCIES } from '@/constants/currencies';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { isLocalDataSource, resetLocalData } from '@/services';
import { useTradingAccounts, useUpdateTradingAccount } from '@/hooks/useTradingAccounts';
import { useFeature } from '@/hooks/useBilling';
import { useMyFeedback } from '@/hooks/useFeedback';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useAllTrades } from '@/hooks/useTrades';
import { downloadText, tradesToCsv } from '@/utils/export';
import { formatDate, todayISO } from '@/utils/date';
import { toast } from '@/store/toastStore';

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your profile and preferences." />
      <ProfileTab />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SecurityCard />
        <MyFeedbackCard />
      </div>
      <DataCard />
    </>
  );
}

/** Change password — available without the old one because the session proves identity. */
function SecurityCard() {
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('The two passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      setPassword('');
      setConfirm('');
      toast.success('Password updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Security" description="Change your password" />
      <CardBody className="space-y-4">
        <Field label="New password" hint="At least 8 characters">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        <div className="flex justify-end">
          <Button loading={saving} onClick={save} disabled={!password}>
            Update password
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** The user's own submissions and where each one got to. */
function MyFeedbackCard() {
  const feedback = useMyFeedback();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Your feedback"
        description="What you've sent us, and what happened to it"
        action={
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" /> Send
          </Button>
        }
      />
      <CardBody>
        {feedback.isLoading ? (
          <LoadingState />
        ) : (feedback.data ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            You haven&apos;t sent any feedback yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {(feedback.data ?? []).map((f) => (
              <li key={f.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge tone={f.status === 'resolved' ? 'profit' : f.status === 'new' ? 'primary' : 'neutral'}>
                    {FEEDBACK_STATUS_LABELS[f.status]}
                  </Badge>
                  <span className="text-xs capitalize text-muted">{f.type}</span>
                  <span className="ml-auto text-xs text-muted">
                    {formatDate(f.createdAt.slice(0, 10), 'MMM D')}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-text">{f.message}</p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

const MODE_LABELS: Record<TradingMode, string> = { forex: 'Forex', indian: 'Indian' };

/**
 * One funded account. Forex and Indian each keep their own capital base, so ROI
 * and drawdown are always measured against the book the trade belongs to.
 */
function AccountCard({ account }: { account: TradingAccount }) {
  const updateAccount = useUpdateTradingAccount();
  const [currency, setCurrency] = useState(account.currency);
  const [capital, setCapital] = useState(String(account.startingCapital));

  const isIndian = account.tradingMode === 'indian';
  const dirty =
    currency !== account.currency || Number(capital) !== account.startingCapital;

  const save = () => {
    updateAccount.mutate(
      {
        tradingMode: account.tradingMode,
        patch: { currency, startingCapital: Number(capital) || 0 },
      },
      {
        onSuccess: () => toast.success(`${MODE_LABELS[account.tradingMode]} account updated.`),
        onError: () => toast.error('Could not update the account.'),
      },
    );
  };

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <p className="text-sm font-medium text-text">{MODE_LABELS[account.tradingMode]} account</p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Field label="Currency" hint={isIndian ? 'Always INR' : undefined}>
          {isIndian ? (
            <Input value="INR" readOnly disabled className="bg-surface text-muted" />
          ) : (
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {ACCOUNT_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Starting capital" hint="Used for ROI & drawdown">
          <Input type="number" step="any" min="0" value={capital} onChange={(e) => setCapital(e.target.value)} />
        </Field>
      </div>
      {dirty && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-loss" />
          Changing starting capital recalculates ROI and drawdown for every trade in this book.
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Button size="sm" loading={updateAccount.isPending} disabled={!dirty} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const accounts = useTradingAccounts();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || user?.displayName,
        phone: phone.trim() || undefined,
      });
      toast.success('Profile updated.');
    } catch {
      toast.error('Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Profile" description="Your account details" />
        <CardBody className="space-y-4">
          <Field label="Display name">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Phone number">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Email" hint="Contact support to change your email">
            <Input value={user?.email ?? ''} disabled />
          </Field>
          <div className="flex justify-end">
            <Button loading={saving} onClick={save}>
              Save profile
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Trading accounts"
            description="Forex and Indian are tracked separately, each with its own capital"
          />
          <CardBody className="space-y-3">
            {accounts.isLoading ? (
              <LoadingState />
            ) : (
              (accounts.data ?? []).map((account) => (
                // Keyed on updatedAt so a save elsewhere remounts the card with
                // fresh values, instead of syncing server state in an effect.
                <AccountCard key={`${account.id}:${account.updatedAt}`} account={account} />
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Appearance" />
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text">Theme</p>
                <p className="text-xs text-muted">Dark is the primary experience.</p>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-border">
                <button type="button" onClick={() => setTheme('dark')} className={`flex items-center gap-1.5 px-3 py-2 text-xs ${theme === 'dark' ? 'bg-primary text-primary-fg' : 'text-muted'}`}>
                  <Moon className="h-3.5 w-3.5" /> Dark
                </button>
                <button type="button" onClick={() => setTheme('light')} className={`flex items-center gap-1.5 px-3 py-2 text-xs ${theme === 'light' ? 'bg-primary text-primary-fg' : 'text-muted'}`}>
                  <Sun className="h-3.5 w-3.5" /> Light
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Local-only developer tool — against a real backend this button would
            do nothing to the user's actual data, so don't show it. */}
        {isLocalDataSource && (
          <Card>
            <CardHeader title="Demo data" description="Demo data lives locally in your browser" />
            <CardBody>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted">Reset everything back to the seeded demo trades.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetLocalData();
                    toast.success('Demo data reset. Reloading…');
                    setTimeout(() => window.location.reload(), 600);
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Export and account deletion — a user must be able to leave with their data. */
function DataCard() {
  const { all: modeTrades } = usePortfolio();
  // Both books, unfiltered: "download everything" must mean everything, not
  // whichever mode the toggle happens to be on.
  const trades = useAllTrades();
  const accounts = useTradingAccounts();
  const user = useAuthStore((s) => s.user);
  // CSV is the paid analyst convenience. The complete JSON export is NOT gated
  // on any plan — being able to leave with your own data is not a feature.
  const canExportCsv = useFeature('export');
  const [confirming, setConfirming] = useState(false);

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: user,
      accounts: accounts.data ?? [],
      trades: trades.data ?? [],
    };
    downloadText(
      `traders-workbook-export-${todayISO()}.json`,
      JSON.stringify(payload, null, 2),
    );
    toast.success('Export downloaded.');
  };

  const exportCsv = () => {
    const rows = trades.data ?? [];
    if (rows.length === 0) {
      toast.error('You have no trades to export.');
      return;
    }
    downloadText(`traders-workbook-trades-${todayISO()}.csv`, tradesToCsv(rows, 0));
    toast.success('CSV downloaded.');
  };

  return (
    <Card className="mt-4">
      <CardHeader title="Your data" description="It's yours — take it with you at any time" />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Download everything: your profile, both accounts and all{' '}
            {(trades.data ?? []).length} trades ({modeTrades.length} in the current mode).
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!canExportCsv}
              title={canExportCsv ? undefined : 'CSV export is available on Pro and Elite'}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson}>
              <Download className="h-4 w-4" /> JSON
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-loss">Delete your account</p>
              <p className="text-xs text-muted">
                Permanently removes your profile, accounts and every trade. This cannot be undone.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 className="h-4 w-4" /> Delete account
            </Button>
          </div>
        </div>
      </CardBody>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete your account?"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-text">
            This removes your profile, both trading accounts and all{' '}
            {(trades.data ?? []).length} of your trades. It cannot be undone.
          </p>
          <p className="text-sm text-muted">
            Export your data first if you want to keep a copy.
          </p>
          {/* Deliberately not self-service: account deletion is irreversible and
              needs an identity check, so it goes through support rather than a
              button that a shared or hijacked session could press. */}
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">
              To delete your account, email{' '}
              <a href="mailto:support@tradersworkbook.app" className="text-primary hover:underline">
                support@tradersworkbook.app
              </a>{' '}
              from <span className="font-medium text-text">{user?.email}</span>. We action these
              within 7 days and confirm by email.
            </p>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
