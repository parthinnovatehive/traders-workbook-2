import { useState } from 'react';
import { GripVertical, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { AnnouncementBanner, BannerTone, FaqEntry, MarketingCopy } from '@/types';
import { BANNER_TONES } from '@/types';
import { DEFAULT_CONTENT } from '@/config/content';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  LoadingState,
  Select,
  Textarea,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { useSiteContent, useUpdateContent } from '@/hooks/useContent';
import { toast } from '@/store/toastStore';
import { uid } from '@/utils/id';

/**
 * Admin → Content.
 *
 * Marketing copy, the FAQ and the announcement banner used to be hardcoded in
 * components, so fixing a typo in the hero or answering a newly common question
 * meant a code change and a redeploy. Each section saves independently — an
 * urgent banner should not require also saving half-edited marketing copy.
 */
export default function AdminContent() {
  const content = useSiteContent();

  if (content.isLoading) return <LoadingState />;
  const data = content.data ?? DEFAULT_CONTENT;

  return (
    <>
      <PageHeader
        title="Content"
        subtitle="Marketing copy, FAQ and the announcement banner — published without a deploy."
      />
      <div className="space-y-4">
        <AnnouncementCard value={data.announcement} />
        <MarketingCard value={data.marketing} />
        <FaqCard value={data.faqs} />
      </div>
    </>
  );
}

/** Tracks a draft copy of one section and whether it differs from what's live. */
function useSection<T>(live: T) {
  const [draft, setDraft] = useState<T>(live);
  const [seen, setSeen] = useState<T>(live);

  // Adjust during render rather than in an effect: when another section's save
  // returns fresh content, this section rebases on it without a second paint.
  if (seen !== live) {
    setSeen(live);
    setDraft(live);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(live);
  return { draft, setDraft, dirty, reset: () => setDraft(live) };
}

function AnnouncementCard({ value }: { value: AnnouncementBanner }) {
  const { draft, setDraft, dirty, reset } = useSection(value);
  const update = useUpdateContent();

  const save = () =>
    update.mutate(
      { announcement: draft },
      {
        onSuccess: () => toast.success('Announcement updated.'),
        onError: () => toast.error('Could not save the announcement.'),
      },
    );

  return (
    <Card>
      <CardHeader
        title="Announcement banner"
        description="Shown above every page, in the app and on the marketing site"
        action={
          draft.enabled ? <Badge tone="primary">Live</Badge> : <Badge tone="neutral">Off</Badge>
        }
      />
      <CardBody className="space-y-4">
        <label className="flex items-center gap-2.5 text-sm text-text">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          Show the banner
        </label>

        <Field label="Message" hint="Keep it to one line — it sits above the whole app">
          <Input
            value={draft.message}
            onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            placeholder="Scheduled maintenance on Sunday 02:00–04:00 IST."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Tone">
            <Select
              value={draft.tone}
              onChange={(e) => setDraft({ ...draft, tone: e.target.value as BannerTone })}
            >
              {BANNER_TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Link label" hint="Optional">
            <Input
              value={draft.linkLabel ?? ''}
              onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })}
              placeholder="Learn more"
            />
          </Field>
          <Field label="Link URL" hint="A path like /pricing, or a full URL">
            <Input
              value={draft.linkHref ?? ''}
              onChange={(e) => setDraft({ ...draft, linkHref: e.target.value })}
              placeholder="/pricing"
            />
          </Field>
        </div>

        <SectionActions dirty={dirty} pending={update.isPending} onReset={reset} onSave={save} />
      </CardBody>
    </Card>
  );
}

function MarketingCard({ value }: { value: MarketingCopy }) {
  const { draft, setDraft, dirty, reset } = useSection(value);
  const update = useUpdateContent();

  const save = () =>
    update.mutate(
      { marketing: draft },
      {
        onSuccess: () => toast.success('Marketing copy updated.'),
        onError: () => toast.error('Could not save the copy.'),
      },
    );

  const set = (key: keyof MarketingCopy, v: string) => setDraft({ ...draft, [key]: v });

  return (
    <Card>
      <CardHeader
        title="Home page copy"
        description="Clearing a field restores its built-in default rather than leaving a blank page"
      />
      <CardBody className="space-y-4">
        <Field label="Hero headline">
          <Textarea
            rows={2}
            value={draft.heroTitle}
            onChange={(e) => set('heroTitle', e.target.value)}
          />
        </Field>
        <Field label="Hero subtitle">
          <Textarea
            rows={3}
            value={draft.heroSubtitle}
            onChange={(e) => set('heroSubtitle', e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Note under the buttons">
            <Input value={draft.heroNote} onChange={(e) => set('heroNote', e.target.value)} />
          </Field>
          <Field label="Closing call to action">
            <Input value={draft.ctaTitle} onChange={(e) => set('ctaTitle', e.target.value)} />
          </Field>
        </div>
        <SectionActions dirty={dirty} pending={update.isPending} onReset={reset} onSave={save} />
      </CardBody>
    </Card>
  );
}

function FaqCard({ value }: { value: FaqEntry[] }) {
  const { draft, setDraft, dirty, reset } = useSection(value);
  const update = useUpdateContent();

  const save = () => {
    const cleaned = draft.filter((f) => f.question.trim() && f.answer.trim());
    if (cleaned.length === 0) {
      toast.error('Keep at least one question, or the FAQ page falls back to the defaults.');
      return;
    }
    update.mutate(
      { faqs: cleaned },
      {
        onSuccess: () => toast.success('FAQ updated.'),
        onError: () => toast.error('Could not save the FAQ.'),
      },
    );
  };

  const setEntry = (id: string, patch: Partial<FaqEntry>) =>
    setDraft(draft.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    const a = draft[index];
    const b = draft[target];
    if (!a || !b) return;
    const next = [...draft];
    next[index] = b;
    next[target] = a;
    setDraft(next);
  };

  return (
    <Card>
      <CardHeader
        title="FAQ"
        description={`${draft.length} ${draft.length === 1 ? 'question' : 'questions'}, in the order they appear`}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDraft([...draft, { id: uid(), question: '', answer: '' }])}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />
      <CardBody className="space-y-3">
        {draft.map((entry, i) => (
          <div key={entry.id} className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center pt-2 text-muted">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded px-1 text-xs hover:text-text disabled:opacity-30"
                >
                  ▲
                </button>
                <GripVertical className="h-3.5 w-3.5" />
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === draft.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded px-1 text-xs hover:text-text disabled:opacity-30"
                >
                  ▼
                </button>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  value={entry.question}
                  onChange={(e) => setEntry(entry.id, { question: e.target.value })}
                  placeholder="Question"
                />
                <Textarea
                  rows={3}
                  value={entry.answer}
                  onChange={(e) => setEntry(entry.id, { answer: e.target.value })}
                  placeholder="Answer"
                />
              </div>

              <button
                type="button"
                aria-label="Remove question"
                onClick={() => setDraft(draft.filter((f) => f.id !== entry.id))}
                className="mt-1 rounded p-1.5 text-muted hover:bg-loss/10 hover:text-loss"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {draft.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">
            No questions. The FAQ page will show the built-in defaults.
          </p>
        )}

        <SectionActions dirty={dirty} pending={update.isPending} onReset={reset} onSave={save} />
      </CardBody>
    </Card>
  );
}

function SectionActions({
  dirty,
  pending,
  onReset,
  onSave,
}: {
  dirty: boolean;
  pending: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
      {dirty && (
        <Button variant="ghost" size="sm" onClick={onReset} disabled={pending}>
          <RotateCcw className="h-3.5 w-3.5" /> Discard
        </Button>
      )}
      <Button size="sm" onClick={onSave} disabled={!dirty} loading={pending}>
        Publish
      </Button>
    </div>
  );
}
