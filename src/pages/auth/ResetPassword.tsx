import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Button, Field, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { AuthShell } from './AuthShell';

/**
 * Landing page for the emailed recovery link. Supabase puts the user into a
 * temporary session when the link is opened, so `updatePassword` works without
 * asking for the old one — but only inside that session, which is why we wait
 * for the auth store to report a user before enabling the form.
 */
export default function ResetPassword() {
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    // The recovery session arrives asynchronously from the URL fragment. Give
    // it a moment before concluding the link is stale.
    if (!ready || user) return;
    const timer = setTimeout(() => setLinkExpired(true), 2500);
    return () => clearTimeout(timer);
  }, [ready, user]);

  const submit = async () => {
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success('Password updated. You are signed in.');
      navigate(ROUTES.app);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
      Back to log in
    </Link>
  );

  if (linkExpired && !user) {
    return (
      <AuthShell title="This link has expired" subtitle="Reset links are valid for one hour." footer={footer}>
        <p className="py-2 text-sm text-muted">
          Request a new link and open it from the same device.
        </p>
        <Link to={ROUTES.forgotPassword}>
          <Button className="mt-2 w-full">Send a new link</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Make it something you don't use elsewhere." footer={footer}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <Field label="New password" required hint="At least 8 characters">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
        </Field>
        <Field label="Confirm new password" required>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button type="submit" className="w-full" loading={busy} disabled={!user}>
          Update password
        </Button>
        {!user && <p className="text-center text-xs text-muted">Verifying your link…</p>}
      </form>
    </AuthShell>
  );
}
