import { useState } from 'react';

import { Moon, RotateCcw, Sun } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';

import { ACCOUNT_CURRENCIES } from '@/constants/currencies';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { resetLocalData } from '@/services';
import { toast } from '@/store/toastStore';

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your profile and preferences." />
      <ProfileTab />
    </>
  );
}

function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [baseCurrency, setBaseCurrency] = useState(user?.baseCurrency ?? 'USD');
  const [startingCapital, setStartingCapital] = useState(String(user?.startingCapital ?? 0));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || user?.displayName,
        baseCurrency,
        startingCapital: Number(startingCapital) || 0,
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
        <CardHeader title="Profile" description="Your account and trading defaults" />
        <CardBody className="space-y-4">
          <Field label="Display name">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={user?.email ?? ''} disabled />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Account currency" hint="Used across P&L, risk & reports">
              <Select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
                {ACCOUNT_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Starting capital" hint="Used for ROI & drawdown">
              <Input type="number" step="any" value={startingCapital} onChange={(e) => setStartingCapital(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button loading={saving} onClick={save}>
              Save profile
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
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

        <Card>
          <CardHeader title="Data" description="Demo data lives locally in your browser" />
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
      </div>
    </div>
  );
}
