import { useMemo, useState } from 'react';
import { Bug, Lightbulb, MessageSquare, Star } from 'lucide-react';
import type { FeedbackStatus, FeedbackType, FeedbackWithAuthor } from '@/types';
import { FEEDBACK_STATUS_LABELS, FEEDBACK_STATUSES } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAdminFeedback, useUpdateFeedback } from '@/hooks/useFeedback';
import { toast } from '@/store/toastStore';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';

const TYPE_ICON: Record<FeedbackType, typeof Bug> = {
  bug: Bug,
  feature: Lightbulb,
  general: MessageSquare,
};

const STATUS_TONE: Record<FeedbackStatus, 'primary' | 'warning' | 'profit' | 'neutral'> = {
  new: 'primary',
  in_review: 'warning',
  resolved: 'profit',
  wont_fix: 'neutral',
};

export default function AdminFeedback() {
  const feedback = useAdminFeedback();
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all');
  const [type, setType] = useState<FeedbackType | 'all'>('all');
  const [selected, setSelected] = useState<FeedbackWithAuthor | null>(null);

  const rows = useMemo(
    () =>
      (feedback.data ?? []).filter(
        (f) => (status === 'all' || f.status === status) && (type === 'all' || f.type === type),
      ),
    [feedback.data, status, type],
  );

  const openCount = (feedback.data ?? []).filter(
    (f) => f.status === 'new' || f.status === 'in_review',
  ).length;

  return (
    <>
      <PageHeader
        title="Feedback"
        subtitle={`${openCount} waiting on a response`}
      />

      <Card className="overflow-hidden">
        <CardBody className="flex flex-wrap items-center gap-3 border-b border-border">
          <Field label="Status" className="w-40">
            <Select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus | 'all')}>
              <option value="all">All statuses</option>
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FEEDBACK_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" className="w-40">
            <Select value={type} onChange={(e) => setType(e.target.value as FeedbackType | 'all')}>
              <option value="all">All types</option>
              <option value="bug">Bug</option>
              <option value="feature">Feature</option>
              <option value="general">General</option>
            </Select>
          </Field>
          <span className="ml-auto text-xs text-muted">{rows.length} shown</span>
        </CardBody>

        {feedback.isLoading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nothing here"
            message="No feedback matches these filters."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((f) => {
              const Icon = TYPE_ICON[f.type];
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(f)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-text">
                          {f.authorName ?? 'Deleted account'}
                        </span>
                        <Badge tone={STATUS_TONE[f.status]}>
                          {FEEDBACK_STATUS_LABELS[f.status]}
                        </Badge>
                        {f.rating != null && (
                          <span className="flex items-center gap-0.5 text-xs text-warning">
                            {f.rating}
                            <Star className="h-3 w-3 fill-warning" />
                          </span>
                        )}
                        {f.page && <span className="text-[10px] text-muted">{f.page}</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{f.message}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {formatDate(f.createdAt.slice(0, 10), 'MMM D')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Feedback"
        description={selected ? `${selected.authorName ?? 'Deleted account'} · ${selected.authorEmail ?? ''}` : ''}
      >
        {selected && <TriageFeedback entry={selected} onDone={() => setSelected(null)} />}
      </Modal>
    </>
  );
}

function TriageFeedback({ entry, onDone }: { entry: FeedbackWithAuthor; onDone: () => void }) {
  const update = useUpdateFeedback();
  const [status, setStatus] = useState<FeedbackStatus>(entry.status);
  const [note, setNote] = useState(entry.adminNote ?? '');

  const save = () => {
    update.mutate(
      { id: entry.id, patch: { status, adminNote: note.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success('Feedback updated.');
          onDone();
        },
        onError: () => toast.error('Could not update the feedback.'),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-2 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge tone="neutral" className="capitalize">
            {entry.type}
          </Badge>
          {entry.rating != null && <span>{entry.rating}/5</span>}
          {entry.page && <span>from {entry.page}</span>}
          <span>{formatDate(entry.createdAt.slice(0, 10), 'MMM D, YYYY')}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-text">{entry.message}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)}>
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {FEEDBACK_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <div className={cn('flex items-end')}>
          <p className="text-xs text-muted">
            The user sees the status on their own feedback list in Settings.
          </p>
        </div>
      </div>

      <Field label="Internal note" hint="Visible to admins only">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did we decide?" />
      </Field>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} loading={update.isPending}>
          Save
        </Button>
      </div>
    </div>
  );
}
