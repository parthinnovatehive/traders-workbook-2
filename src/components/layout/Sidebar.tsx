import { NavLink } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { APP_NAV } from '@/constants/nav';
import { isLocalDataSource } from '@/services';
import { useLogout } from '@/hooks/useLogout';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { Brand } from './Brand';

const APP_VERSION = 'v0.1';

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {APP_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary/12 font-medium text-primary'
                : 'text-muted hover:bg-surface-2 hover:text-text',
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Sign-out lives here as well as in the profile menu. The menu hides it behind
 * an avatar with no label, which is the first place people look last.
 */
function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const logout = useLogout();

  return (
    <div className="border-t border-border p-3">
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          void logout();
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-loss/10 hover:text-loss"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Log out
      </button>
      <p className="px-3 pt-2 text-[11px] text-muted">
        {APP_VERSION}
        {/* Only true against the in-browser mock — never label a real user's
            own trades as demo data. */}
        {isLocalDataSource && ' · Demo data'}
      </p>
    </div>
  );
}

export function Sidebar() {
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Desktop */}
      {/* Pinned to the viewport, not stretched to content height. Otherwise the
          nav and the footer below it scroll away with the page, and on a long
          dashboard "Log out" ends up thousands of pixels down. */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <NavItems />
        </div>
        <SidebarFooter />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-surface">
            <div className="flex h-16 items-center justify-between px-5">
              <Brand />
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
            <SidebarFooter onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
