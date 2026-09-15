import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CandlestickChart,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Sparkles,
  Users,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Badge, Button } from '@/components/ui';
import { Brand } from './Brand';
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
  { to: ROUTES.adminAudit, label: 'Audit Log', icon: ScrollText },
];

export function AdminShell() {
  const overview = useAdminOverview();
  const openFeedback = overview.data?.openFeedback ?? 0;

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

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <nav className="hidden w-52 shrink-0 flex-col gap-0.5 lg:flex">
          {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-surface text-text' : 'text-muted hover:text-text',
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

        {/* Horizontal nav on narrow screens */}
        <nav className="flex gap-1 overflow-x-auto lg:hidden">
          {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs',
                  isActive ? 'bg-surface text-text' : 'text-muted',
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
