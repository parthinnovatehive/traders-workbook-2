import { Link, NavLink, Outlet } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { to: ROUTES.features, label: 'Features' },
  { to: ROUTES.pricing, label: 'Pricing' },
  { to: ROUTES.about, label: 'About' },
  { to: ROUTES.faq, label: 'FAQ' },
];

export function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to={ROUTES.home}>
            <Brand />
          </Link>
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'text-text' : 'text-muted hover:text-text',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link to={ROUTES.login} className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to={ROUTES.register}>
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Brand />
          </div>
          <p>Turn every trade into data. Turn your data into discipline.</p>
          <p className="text-xs">© {new Date().getFullYear()} Trader&apos;s Workbook</p>
        </div>
      </footer>
    </div>
  );
}
