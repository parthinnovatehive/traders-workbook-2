import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { type ToastTone, useToastStore } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-profit/40 text-profit',
  error: 'border-loss/40 text-loss',
  info: 'border-primary/40 text-primary',
  warning: 'border-warning/40 text-warning',
};

const TONE_ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: TriangleAlert,
} as const;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = TONE_ICON[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-lg',
              TONE_STYLES[t.tone],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1 text-text">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="text-muted transition-colors hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
