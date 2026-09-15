import { useMemo, useState } from 'react';
import { Search, ShieldCheck, ShieldOff } from 'lucide-react';
import type { AdminUserRow } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  LoadingState,
  Modal,
  Select,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  useAdminUsers,
  useSetSubscription,
  useSetUserRole,
  useSetUserSuspended,
} from '@/hooks/useAdmin';
import { usePlans } from '@/hooks/usePlans';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';

type Filter = 'all' | 'admins' | 'suspended' | 'paid' | 'free';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'admins', label: 'Admins' },
  { value: 'paid', label: 'Paid' },
  { value: 'free', label: 'Free' },
  { value: 'suspended', label: 'Suspended' },
];

export default function AdminUsers() {
  const users = useAdminUsers();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<AdminUserRow | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users.data ?? []).filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !u.displayName.toLowerCase().includes(q)) {
        return false;
      }
      if (filter === 'admins') return u.role === 'admin';
      if (filter === 'suspended') return u.isSuspended;
      if (filter === 'paid') return Boolean(u.planCode && u.planCode !== 'FREE');
      if (filter === 'free') return !u.planCode || u.planCode === 'FREE';
      return true;
    });
  }, [users.data, query, filter]);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Accounts on the platform. Trade counts only — never trade contents."
      />

      <Card className="overflow-hidden">
        <CardBody className="flex flex-wrap items-center gap-3 border-b border-border">
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            />
          </div>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                  filter === f.value ? 'bg-primary text-primary-fg' : 'text-muted hover:text-text',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">{rows.length} shown</span>
        </CardBody>

        {users.isLoading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title="No users match" message="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 text-right font-medium">Trades</th>
                  <th className="px-3 py-2.5 font-medium">Joined</th>
                  <th className="px-3 py-2.5 font-medium">Last active</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-text">{u.displayName}</span>
                      {u.isSuspended && (
                        <Badge tone="loss" className="ml-2">
                          Suspended
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{u.email}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={u.planCode && u.planCode !== 'FREE' ? 'profit' : 'neutral'}>
                        {u.planName ?? 'None'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={u.role === 'admin' ? 'primary' : 'neutral'}>{u.role}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-muted">{u.tradeCount}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {formatDate(u.createdAt.slice(0, 10), 'MMM D, YYYY')}
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {u.lastActiveAt ? formatDate(u.lastActiveAt.slice(0, 10), 'MMM D') : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelected(u)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.displayName ?? ''}
        description={selected?.email}
      >
        {selected && <ManageUser user={selected} onDone={() => setSelected(null)} />}
      </Modal>
    </>
  );
}

function ManageUser({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const me = useAuthStore((s) => s.user);
  const plans = usePlans();
  const setRole = useSetUserRole();
  const setSuspended = useSetUserSuspended();
  const setSubscription = useSetSubscription();

  const [planId, setPlanId] = useState('');
  const [months, setMonths] = useState('1');
  const [reason, setReason] = useState('');

  const isSelf = me?.id === user.id;

  const grantPlan = () => {
    if (!planId) return;
    setSubscription.mutate(
      { userId: user.id, planId, status: 'active', months: Number(months) || 1 },
      {
        onSuccess: () => {
          toast.success('Subscription updated.');
          onDone();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update the plan.'),
      },
    );
  };

  const toggleRole = () => {
    setRole.mutate(
      { userId: user.id, role: user.role === 'admin' ? 'user' : 'admin' },
      {
        onSuccess: () => {
          toast.success('Role updated.');
          onDone();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not change the role.'),
      },
    );
  };

  const toggleSuspension = () => {
    setSuspended.mutate(
      { userId: user.id, suspended: !user.isSuspended, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(user.isSuspended ? 'Account restored.' : 'Account suspended.');
          onDone();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update the account.'),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Plan" value={user.planName ?? 'None'} />
        <Stat label="Status" value={user.subscriptionStatus ?? '—'} />
        <Stat label="Trades" value={String(user.tradeCount)} />
        <Stat
          label="Last trade"
          value={user.lastTradeAt ? formatDate(user.lastTradeAt.slice(0, 10), 'MMM D') : '—'}
        />
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Subscription</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Plan" className="min-w-40 flex-1">
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">— Choose a plan —</option>
              {(plans.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Months" className="w-24">
            <Input type="number" min="1" value={months} onChange={(e) => setMonths(e.target.value)} />
          </Field>
          <Button size="sm" onClick={grantPlan} loading={setSubscription.isPending} disabled={!planId}>
            Grant
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Manual grant. This is the same path a payment provider will write to later.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Access</p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-text">
              {user.role === 'admin' ? 'Administrator' : 'Standard user'}
            </p>
            <p className="text-xs text-muted">
              {isSelf ? 'You cannot change your own role.' : 'Admins manage the platform.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleRole} loading={setRole.isPending} disabled={isSelf}>
            {user.role === 'admin' ? (
              <>
                <ShieldOff className="h-4 w-4" /> Revoke admin
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Make admin
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          {user.isSuspended ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-loss">Suspended</p>
                <p className="text-xs text-muted">{user.suspendedReason ?? 'No reason recorded.'}</p>
              </div>
              <Button variant="outline" size="sm" onClick={toggleSuspension} loading={setSuspended.isPending}>
                Restore access
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Reason" hint="Recorded in the audit log and shown to the user">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Terms violation…" />
              </Field>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted">
                  A suspended user keeps their data but cannot record or edit trades.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSuspension}
                  loading={setSuspended.isPending}
                  disabled={isSelf}
                >
                  Suspend
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium capitalize text-text">{value}</p>
    </div>
  );
}
