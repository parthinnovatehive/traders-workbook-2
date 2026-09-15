import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Button, Modal } from '@/components/ui';
import { useEntitlements } from '@/hooks/useBilling';

/** Which allowance the user just ran into. */
export type UpgradeReason = 'trades' | 'strategies';

interface Props {
  open: boolean;
  onClose: () => void;
  reason?: UpgradeReason;
  title?: string;
  message?: string;
}

export function UpgradeModal({ open, onClose, reason = 'trades', title, message }: Props) {
  const navigate = useNavigate();
  const { entitlements } = useEntitlements();

  // Copy is derived from the plan's ACTUAL limits rather than hardcoded: the
  // free allowance is admin-editable, so a baked-in "30" becomes a lie the
  // first time someone changes it.
  const tradeLimit = entitlements.tradeLimit;
  const strategyLimit = entitlements.strategyLimit;

  const defaults: Record<UpgradeReason, { title: string; message: string }> = {
    trades: {
      title: 'Upgrade to keep recording trades',
      message: `You've used all ${tradeLimit < 0 ? 'your' : tradeLimit} free trade ${
        tradeLimit === 1 ? 'entry' : 'entries'
      }. Upgrade your membership to continue recording trades — your existing trades stay exactly where they are.`,
    },
    strategies: {
      title: 'Upgrade to add more strategies',
      message: `Your plan includes ${strategyLimit < 0 ? 'unlimited' : strategyLimit} custom ${
        strategyLimit === 1 ? 'strategy' : 'strategies'
      }. Upgrade to track as many setups as you trade — the ones you already have are unaffected.`,
    },
  };

  return (
    <Modal open={open} onClose={onClose} title={title ?? defaults[reason].title} size="md">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted">{message ?? defaults[reason].message}</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
          <Button
            onClick={() => {
              onClose();
              navigate(ROUTES.membership);
            }}
          >
            View Membership Plans
          </Button>
        </div>
      </div>
    </Modal>
  );
}
