import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Button, Field, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { DEMO_EMAIL, DEMO_PASSWORD, isLocalDataSource } from '@/services';
import { AuthShell } from './AuthShell';

export default function Login() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: string, p: string) => {
    setBusy(true);
    try {
      await login(e, p);
      toast.success('Welcome back.');
      navigate(ROUTES.app);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Log in"
      subtitle="Access your trading journal and analytics."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to={ROUTES.register} className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit(email, password);
        }}
        className="space-y-4"
      >
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field label="Password" required>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </Field>
        <div className="flex justify-end">
          <Link to={ROUTES.forgotPassword} className="text-xs text-muted hover:text-primary hover:underline">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>

      {/* The demo account only exists in the local mock repository — against a
          real Supabase project it would be a shared, publicly-known login. */}
      {isLocalDataSource && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={() => void submit(DEMO_EMAIL, DEMO_PASSWORD)} loading={busy}>
            <Sparkles className="h-4 w-4" /> Explore the demo account
          </Button>
          <p className="mt-3 text-center text-xs text-muted">Loaded with sample trades so you can try every feature.</p>
        </>
      )}
    </AuthShell>
  );
}
