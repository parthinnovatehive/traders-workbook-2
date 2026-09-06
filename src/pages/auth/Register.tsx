import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Button, Field, Input, Select } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { AuthShell } from './AuthShell';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'];

export default function Register() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [startingCapital, setStartingCapital] = useState('10000');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!displayName.trim() || !email.trim() || password.length < 6) {
      toast.error('Fill all fields (password ≥ 6 characters).');
      return;
    }
    setBusy(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        baseCurrency,
        startingCapital: Number(startingCapital) || 0,
      });
      toast.success('Account created. Welcome!');
      navigate(ROUTES.app);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

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
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field label="Password" required hint="At least 6 characters">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Base currency">
            <Select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Starting capital">
            <Input type="number" step="any" value={startingCapital} onChange={(e) => setStartingCapital(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
