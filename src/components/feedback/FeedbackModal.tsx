import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug, Lightbulb, MessageSquare, Star } from 'lucide-react';
import type { FeedbackType } from '@/types';
import { Button, Field, Modal, Textarea } from '@/components/ui';
import { useSubmitFeedback } from '@/hooks/useFeedback';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const TYPES: { value: FeedbackType; label: string; icon: typeof Bug }[] = [
  { value: 'bug', label: 'Something is broken', icon: Bug },
  { value: 'feature', label: 'Feature request', icon: Lightbulb },
  { value: 'general', label: 'General feedback', icon: MessageSquare },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * The user's side of the feedback loop. Captures the current route and app
 * version automatically — a bug report without them is usually unactionable.
 */
export function FeedbackModal({ open, onClose }: Props) {
  const location = useLocation();
  const submit = useSubmitFeedback();

  const [type, setType] = useState<FeedbackType>('general');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');

  const reset = () => {
    setType('general');
    setRating(0);
    setMessage('');
  };

  const send = () => {
    if (message.trim().length < 5) {
      toast.error('Please add a little more detail.');
      return;
    }
    submit.mutate(
      {
        type,
        message: message.trim(),
        rating: rating > 0 ? rating : undefined,
        page: location.pathname,
        appVersion: import.meta.env.VITE_APP_VERSION ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success('Thanks — we read every message.');
          reset();
          onClose();
        },
        onError: () => toast.error('Could not send your feedback. Please try again.'),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send feedback"
      description="Tell us what's working and what isn't."
      size="md"
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted">What kind of feedback?</p>
          <div className="grid gap-1.5">
            {TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                  type === value
                    ? 'border-primary/50 bg-primary/10 text-text'
                    : 'border-border text-muted hover:text-text',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">
            How are you finding the app? <span className="text-muted">(optional)</span>
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n === rating ? 0 : n)}
                aria-label={`${n} out of 5`}
                className="rounded p-1 text-muted transition-colors hover:text-warning"
              >
                <Star className={cn('h-5 w-5', n <= rating && 'fill-warning text-warning')} />
              </button>
            ))}
          </div>
        </div>

        <Field label="Your message" required>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              type === 'bug'
                ? 'What did you do, and what happened instead?'
                : 'What would make this more useful for you?'
            }
            className="min-h-28"
          />
        </Field>

        <p className="text-xs text-muted">
          We&apos;ll include the page you&apos;re on ({location.pathname}) so we can reproduce
          issues. Your trades are never attached.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={submit.isPending}>
            Send feedback
          </Button>
        </div>
      </div>
    </Modal>
  );
}
