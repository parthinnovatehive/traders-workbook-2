import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, X } from 'lucide-react';
import { useSiteContent } from '@/hooks/useContent';
import { cn } from '@/utils/cn';

const TONE_STYLES = {
  info: 'border-info/40 bg-info/10 text-info',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  success: 'border-profit/40 bg-profit/10 text-profit',
} as const;

/**
 * The admin-controlled strip — maintenance windows, new features, notices.
 *
 * Dismissal is remembered per message (the storage key includes the text), so
 * editing the announcement shows it again to someone who dismissed the previous
 * one, while re-dismissing the same message stays dismissed.
 */
export function AnnouncementBanner() {
  const { data } = useSiteContent();
  const announcement = data?.announcement;
  const message = announcement?.message?.trim() ?? '';
  const storageKey = `twb.announcement.${hash(message)}`;

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  if (!announcement?.enabled || !message || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // storage unavailable — it just reappears next load
    }
  };

  const hasLink = Boolean(announcement.linkLabel?.trim() && announcement.linkHref?.trim());

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b px-4 py-2 text-sm print:hidden sm:px-6',
        TONE_STYLES[announcement.tone] ?? TONE_STYLES.info,
      )}
    >
      <Info className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 text-text">{message}</p>
      {hasLink &&
        (announcement.linkHref!.startsWith('/') ? (
          <Link to={announcement.linkHref!} className="shrink-0 font-medium hover:underline">
            {announcement.linkLabel}
          </Link>
        ) : (
          <a
            href={announcement.linkHref}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 font-medium hover:underline"
          >
            {announcement.linkLabel}
          </a>
        ))}
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={dismiss}
        className="shrink-0 rounded p-1 hover:bg-current/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Small stable hash so the dismissal key changes with the message. */
function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
