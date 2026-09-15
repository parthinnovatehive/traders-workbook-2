import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Button, Field, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { AuthShell } from './AuthShell';

export default function ForgotPassword() {
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
    } finally {
      // Always show the same confirmation, whether or not the address exists —
      // a different message here would let anyone test which emails have
      // accounts on the platform.
      setBusy(false);
      setSent(true);
    }
  };

  const footer = (
    <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
      Back to log in
    </Link>
  );

  if (sent) {
    return (
      <AuthShell title="Check your inbox" subtitle="If that account exists, a reset link is on its way." footer={footer}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
            <MailCheck className="h-6 w-6" />
          </span>
          <p className="text-sm text-text">
            We sent a password reset link to <span className="font-medium">{email}</span>.
          </p>
          <p className="text-xs text-muted">The link expires in one hour.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to set a new one." footer={footer}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
