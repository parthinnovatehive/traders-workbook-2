import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useEntitlements } from '@/hooks/useBilling';
import { cn } from '@/utils/cn';

/**
 * "22 of 30 trades used", in the shell.
 *
 * The free allowance used to be invisible until the 31st trade was refused at
 * save time — the first a user heard of the limit was losing the entry they had
 * just typed. This surfaces it continuously and starts warning at 80%.
 *
 * Renders nothing on an unlimited plan: a paid user has no allowance to watch.
 */
export function TradeUsageMeter() {
  const { entitlements, isLoading } = useEntitlements();

  if (isLoading || entitlements.tradeLimit < 0) return null;

  const { tradesUsed, tradeLimit, tradesRemaining, tradeUsageRatio } = entitlements;
  const exhausted = tradesRemaining === 0;
  const warning = !exhausted && tradeUsageRatio >= 0.8;

  return (
    <Link
      to={ROUTES.membership}
      title={
        exhausted
          ? 'You have used every trade on your plan — upgrade to record more.'
          : `${tradesRemaining} of your ${tradeLimit} trades remaining`
      }
      className={cn(
        'hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors sm:inline-flex',
        exhausted
          ? 'border-loss/40 bg-loss/10 text-loss hover:bg-loss/15'
          : warning
            ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/15'
            : 'border-border text-muted hover:text-text',
      )}
    >
      <span className="tabular-nums font-medium">
        {tradesUsed} / {tradeLimit}
      </span>
      <span className="hidden lg:inline">{exhausted ? 'limit reached' : 'trades'}</span>
      <span
        aria-hidden
        className="h-1 w-10 overflow-hidden rounded-full bg-current/20"
      >
        <span
          className="block h-full rounded-full bg-current"
          style={{ width: `${Math.round(tradeUsageRatio * 100)}%` }}
        />
      </span>
    </Link>
  );
}
