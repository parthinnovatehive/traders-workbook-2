import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Plan } from '@/types';
import { ROUTES } from '@/constants/routes';
import { Badge, Button, Card, CardBody, CardHeader, Input, LoadingState, MetricCard, Tabs } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { Brand } from '@/components/layout/Brand';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useAdminSubscriptions, useAdminUsers } from '@/hooks/useAdmin';
import { usePlans, useUpdatePlan } from '@/hooks/usePlans';
import { toast } from '@/store/toastStore';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';

const TABS = [
  { value: 'analytics', label: 'System' },
  { value: 'users', label: 'Users' },
  { value: 'plans', label: 'Plans & Pricing' },
];

export default function Admin() {
  const [tab, setTab] = useState('analytics');
  const users = useAdminUsers();
  const subs = useAdminSubscriptions();
  const plans = usePlans();

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-bg/90 px-4 backdrop-blur sm:px-6">
        <Brand />
        <Badge tone="primary">Admin</Badge>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link to={ROUTES.app}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> Back to app
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <PageHeader title="Admin Panel" subtitle="Manage users, plans and system configuration.">
          <Tabs items={TABS} value={tab} onChange={setTab} />
        </PageHeader>

        {tab === 'analytics' && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Total Users" value={users.data?.length ?? '—'} />
            <MetricCard label="Active Subscriptions" value={subs.data?.filter((s) => s.status === 'active').length ?? '—'} />
            <MetricCard label="Plans" value={plans.data?.length ?? '—'} />
            <MetricCard label="Admins" value={users.data?.filter((u) => u.role === 'admin').length ?? '—'} />
          </div>
        )}

        {tab === 'users' && (
          <Card className="overflow-hidden">
            <CardHeader title="Users" description="Accounts on the platform" />
            {users.isLoading ? (
              <LoadingState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-3 py-2.5 font-medium">Email</th>
                      <th className="px-3 py-2.5 font-medium">Role</th>
                      <th className="px-3 py-2.5 font-medium">Currency</th>
                      <th className="px-3 py-2.5 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users.data ?? []).map((u) => (
                      <tr key={u.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-text">{u.displayName}</td>
                        <td className="px-3 py-2.5 text-muted">{u.email}</td>
                        <td className="px-3 py-2.5">
                          <Badge tone={u.role === 'admin' ? 'primary' : 'neutral'}>{u.role}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-muted">{u.baseCurrency}</td>
                        <td className="px-3 py-2.5 text-muted">{formatDate(u.createdAt.slice(0, 10), 'MMM D, YYYY')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-border px-4 py-3 text-xs text-muted">
              Admins manage plans and content — never individual users&apos; private trade data.
            </div>
          </Card>
        )}

        {tab === 'plans' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(plans.data ?? []).map((plan) => (
              <PlanEditor key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function PlanEditor({ plan }: { plan: Plan }) {
  const updatePlan = useUpdatePlan();
  const [price, setPrice] = useState(String(plan.price));
  const [active, setActive] = useState(plan.isActive);

  const save = () => {
    updatePlan.mutate(
      { id: plan.id, patch: { price: Number(price), isActive: active } },
      {
        onSuccess: () => toast.success(`${plan.name} plan updated.`),
        onError: () => toast.error('Could not update plan.'),
      },
    );
  };

  return (
    <Card>
      <CardHeader title={plan.name} description={`${plan.code} · ${plan.billingPeriod}`} action={<Badge tone={active ? 'profit' : 'neutral'}>{active ? 'Active' : 'Hidden'}</Badge>} />
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">{plan.currency}</span>
          <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" />
          <span className="text-sm text-muted">/ {plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
        </div>
        <ul className="space-y-1 text-xs text-muted">
          {plan.features.slice(0, 4).map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-primary" />
          Visible on pricing page
        </label>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{formatCurrency(Number(price), plan.currency)} / {plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
          <Button size="sm" loading={updatePlan.isPending} onClick={save}>
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
