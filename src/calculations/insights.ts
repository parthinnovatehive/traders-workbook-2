import type { Strategy, Trade } from '@/types';
import { conditionalPerformance, performanceByMistake, segmentStats } from './analytics';
import { closedTradesInOrder } from './performance';
import { hourOf } from '@/utils/date';
import { computeStrategyPerformance } from './strategy';

export type InsightTone = 'positive' | 'negative' | 'neutral';
export type Confidence = 'low' | 'medium' | 'high';

export interface Insight {
  id: string;
  title: string;
  detail: string;
  tone: InsightTone;
  sampleSize: number;
  confidence: Confidence;
}

/** Minimum closed trades in a segment before we will state an insight about it. */
const MIN_SAMPLE = 4;

function confidenceFor(sample: number): Confidence {
  if (sample >= 20) return 'high';
  if (sample >= 8) return 'medium';
  return 'low';
}

/**
 * Generate rule-based insights ONLY from stored trade data. Every rule guards on
 * sample size; nothing is emitted when the data is too thin (Sections 17-18).
 * The signature is intentionally simple so a future AI layer can implement the
 * same `Insight[]` contract.
 */
export function generateInsights(
  trades: readonly Trade[],
  opts: { strategies?: readonly Strategy[]; startingCapital?: number } = {},
): Insight[] {
  const insights: Insight[] = [];
  const closed = closedTradesInOrder(trades);
  if (closed.length < MIN_SAMPLE) return insights;

  const overall = segmentStats(closed);

  // 1) Performance after a loss.
  const cond = conditionalPerformance(trades);
  if (
    cond.afterLoss.trades >= MIN_SAMPLE &&
    overall.winRate !== null &&
    cond.afterLoss.winRate !== null &&
    overall.winRate - cond.afterLoss.winRate >= 8
  ) {
    insights.push({
      id: 'after-loss',
      title: 'Your edge drops after a loss',
      detail: `Your win rate falls from ${overall.winRate.toFixed(0)}% overall to ${cond.afterLoss.winRate.toFixed(
        0,
      )}% on the trade right after a loss.`,
      tone: 'negative',
      sampleSize: cond.afterLoss.trades,
      confidence: confidenceFor(cond.afterLoss.trades),
    });
  }

  // 2) Time-of-day: morning vs afternoon average R.
  const morning: Trade[] = [];
  const afternoon: Trade[] = [];
  for (const t of closed) {
    const h = hourOf(t.entryTime);
    if (h === null) continue;
    if (h < 12) morning.push(t);
    else afternoon.push(t);
  }
  const mStats = segmentStats(morning);
  const aStats = segmentStats(afternoon);
  if (
    mStats.trades >= MIN_SAMPLE &&
    aStats.trades >= MIN_SAMPLE &&
    mStats.avgR !== null &&
    aStats.avgR !== null &&
    mStats.avgR - aStats.avgR >= 0.3
  ) {
    insights.push({
      id: 'time-of-day',
      title: 'Mornings are your strongest window',
      detail: `Your average R is ${mStats.avgR.toFixed(2)}R before noon versus ${aStats.avgR.toFixed(
        2,
      )}R in the afternoon.`,
      tone: 'positive',
      sampleSize: mStats.trades + aStats.trades,
      confidence: confidenceFor(mStats.trades + aStats.trades),
    });
  }

  // 3) A specific mistake drives the biggest losses.
  const mistakes = performanceByMistake(trades).filter((m) => m.trades >= MIN_SAMPLE);
  const worstMistake = mistakes.toSorted((x, y) => x.netPnl - y.netPnl)[0];
  if (worstMistake && worstMistake.netPnl < 0) {
    insights.push({
      id: `mistake-${worstMistake.code}`,
      title: `"${worstMistake.label}" is costing you`,
      detail: `Trades tagged "${worstMistake.label}" have a combined net of ${worstMistake.netPnl.toFixed(
        0,
      )} across ${worstMistake.trades} trades${
        worstMistake.winRate !== null ? ` (win rate ${worstMistake.winRate.toFixed(0)}%)` : ''
      }.`,
      tone: 'negative',
      sampleSize: worstMistake.trades,
      confidence: confidenceFor(worstMistake.trades),
    });
  }

  // 4) Best vs worst strategy by expectancy (only if strategies provided).
  if (opts.strategies && opts.strategies.length > 0) {
    const perf = computeStrategyPerformance(trades, opts.strategies, opts.startingCapital ?? 0)
      .filter((s) => s.totalTrades >= MIN_SAMPLE && s.expectancy !== null)
      .toSorted((a, b) => (b.expectancy ?? 0) - (a.expectancy ?? 0));
    const best = perf[0];
    const worst = perf[perf.length - 1];
    if (best && worst && best.strategyId !== worst.strategyId) {
      insights.push({
        id: 'strategy-expectancy',
        title: `${best.name} outperforms ${worst.name}`,
        detail: `${best.name} has an expectancy of ${(best.expectancy ?? 0).toFixed(
          0,
        )} per trade versus ${(worst.expectancy ?? 0).toFixed(0)} for ${worst.name}.`,
        tone: 'positive',
        sampleSize: best.totalTrades + worst.totalTrades,
        confidence: confidenceFor(best.totalTrades + worst.totalTrades),
      });
    }
  }

  return insights;
}
