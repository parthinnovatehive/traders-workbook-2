import type { TradeCalcInput, TradeMetrics, TradeStatus } from '@/types';
import { isClosed } from './guards';
import { grossPnl, netPnl, tradeOutcome } from './pnl';
import { initialRisk, plannedReward, riskReward } from './risk';
import { rMultiple } from './rmultiple';
import { roi } from './roi';

/** A trade is closed once it has a valid exit price, otherwise open. */
export function tradeStatus(trade: Pick<TradeCalcInput, 'exitPrice'>): TradeStatus {
  return isClosed(trade.exitPrice) ? 'closed' : 'open';
}

/**
 * Compose all per-trade metrics from the primitives. This is the single object
 * the trade-entry summary and the journal row both read from — no component
 * recomputes any of these values.
 */
export function computeTradeMetrics(
  trade: TradeCalcInput,
  opts?: { startingCapital?: number },
): TradeMetrics {
  const net = netPnl(trade);
  return {
    status: tradeStatus(trade),
    grossPnl: grossPnl(trade),
    netPnl: net,
    outcome: tradeOutcome(net),
    risk: initialRisk(trade),
    reward: plannedReward(trade),
    riskReward: riskReward(trade),
    rMultiple: rMultiple(trade),
    roi: opts?.startingCapital !== undefined ? roi(net, opts.startingCapital) : null,
  };
}
