import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { AUDIT_ACTION_LABELS } from '@/types';
import { Badge, Card, CardBody, EmptyState, Field, LoadingState, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAdminAuditLog } from '@/hooks/useAdmin';
import { formatDate } from '@/utils/date';

/** Renders a before/after diff compactly — only the keys that actually changed. */
function diffPairs(
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
): { key: string; from: string; to: string }[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const show = (v: unknown) =>
    v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

  return [...keys]
    .map((key) => ({ key, from: show(before?.[key]), to: show(after?.[key]) }))
    .filter((p) => p.from !== p.to);
}

export default function AdminAudit() {
  const log = useAdminAuditLog(200);
  const [action, setAction] = useState('all');

  const actions = useMemo(
    () => [...new Set((log.data ?? []).map((e) => e.action))].toSorted(),
    [log.data],
  );

  const rows = useMemo(
    () => (log.data ?? []).filter((e) => action === 'all' || e.action === action),
    [log.data, action],
  );

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Every privileged action, with who did it and what changed."
      />

      <Card className="overflow-hidden">
        <CardBody className="flex flex-wrap items-center gap-3 border-b border-border">
          <Field label="Action" className="w-52">
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {AUDIT_ACTION_LABELS[a] ?? a}
                </option>
              ))}
            </Select>
          </Field>
          <span className="ml-auto text-xs text-muted">{rows.length} entries</span>
        </CardBody>

        {log.isLoading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nothing logged yet"
            message="Admin actions such as role changes and plan grants will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((entry) => {
              const pairs = diffPairs(entry.before, entry.after);
              return (
                <li key={entry.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="primary">
                      {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                    </Badge>
                    <span className="text-sm text-text">{entry.actorEmail ?? 'Unknown admin'}</span>
                    <span className="text-xs text-muted">
                      on {entry.targetType}
                      {entry.targetId ? ` ${entry.targetId.slice(0, 8)}…` : ''}
                    </span>
                    <span className="ml-auto text-xs text-muted">
                      {formatDate(entry.createdAt.slice(0, 10), 'MMM D, YYYY')}{' '}
                      {entry.createdAt.slice(11, 16)}
                    </span>
                  </div>

                  {pairs.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      {pairs.map((p) => (
                        <span key={p.key} className="text-xs text-muted">
                          <span className="font-medium">{p.key}</span>: {p.from}{' '}
                          <span className="text-text">→ {p.to}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
