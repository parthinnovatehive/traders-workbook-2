import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { ACCOUNT_CURRENCIES } from '@/constants/currencies';
import { Button, Field, Input, PasswordInput, Select } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { landingRouteFor } from '@/routes/landing';
import { AuthShell } from './AuthShell';

export default function Register() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [forexCurrency, setForexCurrency] = useState('USD');
  const [forexCapital, setForexCapital] = useState('10000');
  const [indianCapital, setIndianCapital] = useState('100000');
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const submit = async () => {
    if (!displayName.trim() || !email.trim() || password.length < 8) {
      toast.error('Fill all required fields (password must be at least 8 characters).');
      return;
    }
    setBusy(true);
    try {
      const signedIn = await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        forexCurrency,
        forexStartingCapital: Number(forexCapital) || 0,
        indianStartingCapital: Number(indianCapital) || 0,
      });

      if (!signedIn) {
        // Email confirmation is on — there is no session yet, so sending the
        // user into the app would just bounce them back to the login screen.
        setAwaitingConfirmation(true);
        return;
      }
      toast.success('Account created. Welcome!');
      // A brand-new account is always a trader, but route through the shared
      // helper anyway so this page can never disagree with the others.
      navigate(landingRouteFor(signedIn), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <AuthShell
        title="Confirm your email"
        subtitle="One more step before you can log in."
        footer={
          <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
            Back to log in
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
            <MailCheck className="h-6 w-6" />
          </span>
          <p className="text-sm text-text">
            We sent a confirmation link to <span className="font-medium">{email}</span>.
          </p>
          <p className="text-xs text-muted">
            Click it to activate your account, then log in. Check your spam folder if it hasn&apos;t
            arrived in a couple of minutes.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start turning your trades into discipline."
      footer={
        <>
          Already have an account?{' '}
          <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <Field label="Display name" required>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jordan" />
        </Field>
        <Field label="Phone number">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field label="Password" required hint="At least 8 characters">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>

        {/* Two books, two capital bases — ROI and drawdown are computed against
            whichever account a trade belongs to. Either can be set later. */}
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Your accounts</p>
          <p className="mt-1 text-xs text-muted">
            Forex and Indian are tracked separately. You can change these any time in Settings.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Forex currency">
              <Select value={forexCurrency} onChange={(e) => setForexCurrency(e.target.value)}>
                {ACCOUNT_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Forex capital">
              <Input type="number" step="any" min="0" value={forexCapital} onChange={(e) => setForexCapital(e.target.value)} />
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Indian currency">
              <Input value="INR" readOnly disabled className="bg-surface text-muted" />
            </Field>
            <Field label="Indian capital" hint="₹">
              <Input type="number" step="any" min="0" value={indianCapital} onChange={(e) => setIndianCapital(e.target.value)} />
            </Field>
          </div>
        </div>

        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
