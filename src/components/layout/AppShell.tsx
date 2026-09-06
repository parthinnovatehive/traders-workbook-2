import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Modal } from '@/components/ui';
import { TradeForm } from '@/components/forms/TradeForm';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { useEntitlements } from '@/hooks/useBilling';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const [quickAdd, setQuickAdd] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { entitlements } = useEntitlements();

  const openQuickAdd = () => {
    if (entitlements.canCreateTrade) setQuickAdd(true);
    else setUpgradeOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onNewTrade={openQuickAdd} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <MobileNav onQuickAdd={openQuickAdd} />

      <Modal
        open={quickAdd}
        onClose={() => setQuickAdd(false)}
        title="Quick Add Trade"
        description="Record a trade in seconds — key fields only."
        size="lg"
      >
        <TradeForm variant="quick" onDone={() => setQuickAdd(false)} />
      </Modal>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
