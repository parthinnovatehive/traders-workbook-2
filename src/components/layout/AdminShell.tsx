import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CandlestickChart,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Sparkles,
  Users,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Badge, Button } from '@/components/ui';
import { Brand } from './Brand';
import { ProfileMenu } from './ProfileMenu';
import { ThemeToggle } from './ThemeToggle';
import { useAdminOverview } from '@/hooks/useAdmin';
import { cn } from '@/utils/cn';

const ADMIN_NAV = [
  { to: ROUTES.admin, label: 'Overview', icon: LayoutDashboard, end: true },
  { to: ROUTES.adminUsers, label: 'Users', icon: Users },
  { to: ROUTES.adminSubscriptions, label: 'Subscriptions', icon: CreditCard },
  { to: ROUTES.adminPlans, label: 'Plans & Pricing', icon: Sparkles },
  { to: ROUTES.adminInstruments, label: 'Instruments', icon: CandlestickChart },
  { to: ROUTES.adminFeedback, label: 'Feedback', icon: MessageSquare },
  { to: ROUTES.adminContent, label: 'Content', icon: FileText },
  { to: ROUTES.adminAudit, label: 'Audit Log', icon: ScrollText },
];

export function AdminShell() {
  const overview = useAdminOverview();
  const openFeedback = overview.data?.openFeedback ?? 0;

  return (
    // Mirrors AppShell: a bordered sidebar flush to the viewport edge, with the
    // header inside the content column. The previous layout centred a bare nav
    // inside a max-w-7xl row, so on a wide monitor it floated hundreds of
    // pixels inward while the logo stayed pinned left — the two shells looked
    // like different products.
    <div className="flex min-h-screen bg-bg">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen">
        {/* Brand only, exactly as AppShell does it — the wordmark plus a badge
            wraps to two lines at this width. The "Admin" marker lives in the
            header instead. */}
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <nav className="flex flex-col gap-0.5 px-3">
            {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/12 font-medium text-primary'
                      : 'text-muted hover:bg-surface-2 hover:text-text',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {label === 'Feedback' && openFeedback > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-fg">
                    {openFeedback}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-border p-3">
          <Link to={ROUTES.app} className="block">
            <Button variant="outline" size="sm" className="w-full justify-center">
              <ArrowLeft className="h-4 w-4" /> Back to app
            </Button>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur sm:px-6">
          {/* The sidebar carries the brand on desktop; repeat it only where the
              sidebar is hidden. */}
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <Badge tone="primary">Admin</Badge>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link to={ROUTES.app} className="lg:hidden">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" /> App
              </Button>
            </Link>
            {/* The admin section had no sign-out at all: the only way out was to
                return to the app first and find the avatar there. */}
            <ProfileMenu />
          </div>
        </header>

        {/* Horizontal nav on narrow screens, where the sidebar is hidden. */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:hidden">
          {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs',
                  isActive ? 'bg-primary/12 font-medium text-primary' : 'text-muted',
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
