import { Menu, Plus } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { isLocalDataSource } from '@/services';
import { useUiStore } from '@/store/uiStore';
import { Brand } from './Brand';
import { ModeToggle } from './ModeToggle';
import { ProfileMenu } from './ProfileMenu';
import { ThemeToggle } from './ThemeToggle';
import { TradeUsageMeter } from './TradeUsageMeter';

export function Header({ onNewTrade }: { onNewTrade: () => void }) {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur print:hidden sm:px-6">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setSidebarOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="lg:hidden">
        <Brand compact />
      </div>

      {/* Trading mode — prominent, stays accessible on mobile */}
      <ModeToggle className="ml-1" />

      <div className="ml-auto flex items-center gap-2">
        {/* Only true against the in-browser mock repository. Showing it to a
            real user looking at their own trades says the app is a toy. */}
        {isLocalDataSource && (
          <Badge tone="warning" className="hidden md:inline-flex">
            Demo data
          </Badge>
        )}
        <TradeUsageMeter />
        <Button size="sm" onClick={onNewTrade} className="hidden sm:inline-flex">
          <Plus className="h-4 w-4" /> New Trade
        </Button>
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
