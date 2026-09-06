import type { Trade } from '@/types';
import { MISTAKE_LABELS, type MistakeCode, PSYCH_LABELS, type PsychCode } from '@/constants/journal';
import { roundMoney, roundTo } from '@/utils/money';
import { closedTradesInOrder, winRate } from './performance';
import { netPnl } from './pnl';
import { rMultiple } from './rmultiple';

export interface SegmentStats {
  trades: number;
  netPnl: number;
  winRate: number | null;
  avgR: number | null;
}

/** Summary stats for an arbitrary subset of trades. */
export function segmentStats(trades: readonly Trade[]): SegmentStats {
  const closed = closedTradesInOrder(trades);
  const nets = closed.map((t) => netPnl(t) ?? 0);
  const rs: number[] = [];
  for (const t of closed) {
    const r = rMultiple(t);
    if (r !== null) rs.push(r);
  }
  return {
    trades: closed.length,
    netPnl: roundMoney(nets.reduce((a, b) => a + b, 0)),
    winRate: winRate(nets),
    avgR: rs.length > 0 ? roundTo(rs.reduce((a, b) => a + b, 0) / rs.length, 2) : null,
  };
}

export interface TagPerformance extends SegmentStats {
  code: string;
  label: string;
}

function performanceByTags(
  trades: readonly Trade[],
  getTags: (t: Trade) => readonly string[],
  labelOf: (code: string) => string,
): TagPerformance[] {
  const groups = new Map<string, Trade[]>();
  for (const t of closedTradesInOrder(trades)) {
    for (const tag of getTags(t)) {
      const bucket = groups.get(tag);
      if (bucket) bucket.push(t);
      else groups.set(tag, [t]);
    }
  }
  return [...groups.entries()]
    .map(([code, group]) => ({ code, label: labelOf(code), ...segmentStats(group) }))
    .toSorted((a, b) => b.netPnl - a.netPnl);
}

export function performanceByPsychology(trades: readonly Trade[]): TagPerformance[] {
  return performanceByTags(
    trades,
    (t) => t.psychology,
    (c) => PSYCH_LABELS[c as PsychCode] ?? c,
  );
}

export function performanceByMistake(trades: readonly Trade[]): TagPerformance[] {
  return performanceByTags(
    trades,
    (t) => t.mistakes,
    (c) => MISTAKE_LABELS[c as MistakeCode] ?? c,
  );
}

export interface ConditionalPerformance {
  overall: SegmentStats;
  afterWin: SegmentStats;
  afterLoss: SegmentStats;
}

/** How performance changes on the trade immediately following a win vs a loss. */
export function conditionalPerformance(trades: readonly Trade[]): ConditionalPerformance {
  const closed = closedTradesInOrder(trades);
  const afterWin: Trade[] = [];
  const afterLoss: Trade[] = [];
  for (let i = 1; i < closed.length; i += 1) {
    const prev = closed[i - 1];
    const cur = closed[i];
    if (!prev || !cur) continue;
    const prevNet = netPnl(prev) ?? 0;
    if (prevNet > 0) afterWin.push(cur);
    else if (prevNet < 0) afterLoss.push(cur);
  }
  return {
    overall: segmentStats(closed),
    afterWin: segmentStats(afterWin),
    afterLoss: segmentStats(afterLoss),
  };
}

export interface Streaks {
  currentStreak: number; // positive = wins, negative = losses
  longestWin: number;
  longestLoss: number;
}

export function streaks(trades: readonly Trade[]): Streaks {
  let current = 0;
  let longestWin = 0;
  let longestLoss = 0;
  for (const t of closedTradesInOrder(trades)) {
    const net = netPnl(t) ?? 0;
    if (net > 0) current = current > 0 ? current + 1 : 1;
    else if (net < 0) current = current < 0 ? current - 1 : -1;
    else current = 0;
    if (current > longestWin) longestWin = current;
    if (-current > longestLoss) longestLoss = -current;
  }
  return { currentStreak: current, longestWin, longestLoss };
}
