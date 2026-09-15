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

const LEGAL_LINKS = [
  { to: ROUTES.terms, label: 'Terms' },
  { to: ROUTES.privacy, label: 'Privacy' },
  { to: ROUTES.refunds, label: 'Refunds' },
  { to: ROUTES.contact, label: 'Contact' },
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
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
            <Brand />
            <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
              {LEGAL_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="hover:text-text">
                  {l.label}
                </Link>
              ))}
            </nav>
            <p className="text-xs">© {new Date().getFullYear()} Trader&apos;s Workbook</p>
          </div>

          {/* Required context whenever performance figures are shown to retail
              traders — and what a payment gateway will look for at onboarding. */}
          <p className="mt-6 border-t border-border pt-4 text-center text-xs leading-relaxed text-muted">
            Trader&apos;s Workbook is a journaling and analytics tool. It is not investment advice
            and not a recommendation to buy or sell any instrument. We are not a registered
            investment adviser. Trading involves substantial risk of loss.
          </p>
        </div>
      </footer>
    </div>
  );
}
