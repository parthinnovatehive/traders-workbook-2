import { NavLink } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { MOBILE_NAV } from '@/constants/nav';
import { cn } from '@/utils/cn';

export function MobileNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-surface px-2 py-1.5 lg:hidden">
      {MOBILE_NAV.slice(0, 2).map((item) => (
        <NavItem key={item.to} {...item} />
      ))}

      <button
        type="button"
        onClick={onQuickAdd}
        aria-label="Quick add trade"
        className="grid h-11 w-11 -translate-y-3 place-items-center rounded-full bg-primary text-primary-fg shadow-lg"
      >
        <Plus className="h-5 w-5" />
      </button>

      {MOBILE_NAV.slice(2).map((item) => (
        <NavItem key={item.to} {...item} />
      ))}
    </nav>
  );
}

function NavItem({ to, label, icon: Icon, end }: (typeof MOBILE_NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex w-16 flex-col items-center gap-0.5 rounded-md py-1 text-[10px] font-medium',
          isActive ? 'text-primary' : 'text-muted',
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
}
