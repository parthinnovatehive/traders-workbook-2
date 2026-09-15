import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MessageSquarePlus, Shield, User as UserIcon } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

export function ProfileMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;
  const initials = user.displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2 text-xs font-semibold text-text"
        aria-label="Account menu"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-56 rounded-lg border border-border bg-surface p-1 shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-text">{user.displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <MenuButton icon={UserIcon} label="Settings" onClick={() => { setOpen(false); navigate(ROUTES.settings); }} />
          <MenuButton
            icon={MessageSquarePlus}
            label="Send feedback"
            onClick={() => { setOpen(false); setFeedbackOpen(true); }}
          />
          {user.role === 'admin' && (
            <MenuButton icon={Shield} label="Admin Panel" onClick={() => { setOpen(false); navigate(ROUTES.admin); }} />
          )}
          <MenuButton
            icon={LogOut}
            label="Log out"
            tone="loss"
            onClick={async () => {
              setOpen(false);
              await logout();
              toast.info('Logged out.');
              navigate(ROUTES.home);
            }}
          />
        </div>
      )}

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: typeof UserIcon;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'loss';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface-2',
        tone === 'loss' ? 'text-loss' : 'text-text',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
