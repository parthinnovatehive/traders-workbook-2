import type { ISODate, Trade } from '@/types';
import { roundMoney, roundTo } from '@/utils/money';
import { isClosed } from './guards';
import { netPnl } from './pnl';
import { rMultiple } from './rmultiple';

/**
 * Calendar aggregation — pure, no dates-from-now, no React. A trade lands on the
 * day its P&L was REALIZED (its exit date), falling back to the entry date for
 * a trade that is still open, so an open position shows on the day it was taken.
 */

export interface DayStats {
  date: ISODate;
  netPnl: number;
  grossTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number | null;
  totalR: number | null;
  best: number | null;
  worst: number | null;
  charges: number;
}

/** The day a trade belongs to on the calendar. */
export function calendarDate(trade: Trade): ISODate {
  return isClosed(trade.exitPrice) ? (trade.exitDate ?? trade.entryDate) : trade.entryDate;
}

function emptyDay(date: ISODate): DayStats {
  return {
    date,
    netPnl: 0,
    grossTrades: 0,
    closedTrades: 0,
    openTrades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    winRate: null,
    totalR: null,
    best: null,
    worst: null,
    charges: 0,
  };
}

/** Every day that has at least one trade, keyed by ISO date. */
export function groupTradesByDay(trades: readonly Trade[]): Map<ISODate, Trade[]> {
  const map = new Map<ISODate, Trade[]>();
  for (const trade of trades) {
    const key = calendarDate(trade);
    const list = map.get(key);
    if (list) list.push(trade);
    else map.set(key, [trade]);
  }
  return map;
}

/** Aggregate one day's trades into the figures a calendar cell shows. */
export function computeDayStats(date: ISODate, trades: readonly Trade[]): DayStats {
  const day = emptyDay(date);
  day.grossTrades = trades.length;

  let rSum = 0;
  let rCount = 0;

  for (const trade of trades) {
    if (!isClosed(trade.exitPrice)) {
      day.openTrades += 1;
      continue;
    }
    const net = netPnl(trade) ?? 0;
    day.closedTrades += 1;
    day.netPnl += net;
    day.charges += trade.charges;

    if (net > 0) day.wins += 1;
    else if (net < 0) day.losses += 1;
    else day.breakevens += 1;

    day.best = day.best === null ? net : Math.max(day.best, net);
    day.worst = day.worst === null ? net : Math.min(day.worst, net);

    const r = rMultiple(trade);
    if (r !== null) {
      rSum += r;
      rCount += 1;
    }
  }

  day.netPnl = roundMoney(day.netPnl);
  day.charges = roundMoney(day.charges);
  day.winRate = day.closedTrades > 0 ? roundTo((day.wins / day.closedTrades) * 100, 2) : null;
  day.totalR = rCount > 0 ? roundTo(rSum, 2) : null;
  return day;
}

/** Day stats for every day that has trades, keyed by ISO date. */
export function computeDayStatsMap(trades: readonly Trade[]): Map<ISODate, DayStats> {
  const grouped = groupTradesByDay(trades);
  const result = new Map<ISODate, DayStats>();
  for (const [date, dayTrades] of grouped) {
    result.set(date, computeDayStats(date, dayTrades));
  }
  return result;
}

export interface PeriodSummary {
  netPnl: number;
  tradingDays: number;
  winDays: number;
  lossDays: number;
  flatDays: number;
  closedTrades: number;
  openTrades: number;
  bestDay: DayStats | null;
  worstDay: DayStats | null;
  /** Longest run of consecutive PROFITABLE trading days in the period. */
  longestWinStreak: number;
  /** Longest run of consecutive LOSING trading days in the period. */
  longestLossStreak: number;
  avgDailyPnl: number | null;
}

/**
 * Summarise a set of day stats. Streaks count consecutive TRADING days, not
 * calendar days — a weekend between two green days does not break the run.
 */
export function summarisePeriod(days: readonly DayStats[]): PeriodSummary {
  const ordered = days.toSorted((a, b) => a.date.localeCompare(b.date));
  const summary: PeriodSummary = {
    netPnl: 0,
    tradingDays: ordered.length,
    winDays: 0,
    lossDays: 0,
    flatDays: 0,
    closedTrades: 0,
    openTrades: 0,
    bestDay: null,
    worstDay: null,
    longestWinStreak: 0,
    longestLossStreak: 0,
    avgDailyPnl: null,
  };

  let winRun = 0;
  let lossRun = 0;

  for (const day of ordered) {
    summary.netPnl += day.netPnl;
    summary.closedTrades += day.closedTrades;
    summary.openTrades += day.openTrades;

    if (day.netPnl > 0) {
      summary.winDays += 1;
      winRun += 1;
      lossRun = 0;
    } else if (day.netPnl < 0) {
      summary.lossDays += 1;
      lossRun += 1;
      winRun = 0;
    } else {
      summary.flatDays += 1;
      winRun = 0;
      lossRun = 0;
    }

    summary.longestWinStreak = Math.max(summary.longestWinStreak, winRun);
    summary.longestLossStreak = Math.max(summary.longestLossStreak, lossRun);

    if (day.closedTrades > 0) {
      if (!summary.bestDay || day.netPnl > summary.bestDay.netPnl) summary.bestDay = day;
      if (!summary.worstDay || day.netPnl < summary.worstDay.netPnl) summary.worstDay = day;
    }
  }

  summary.netPnl = roundMoney(summary.netPnl);
  const withTrades = ordered.filter((d) => d.closedTrades > 0);
  summary.avgDailyPnl =
    withTrades.length > 0
      ? roundMoney(withTrades.reduce((a, d) => a + d.netPnl, 0) / withTrades.length)
      : null;

  return summary;
}

/**
 * The largest absolute day P&L in a set — used to scale the heat-map intensity
 * so colour is relative to the trader's own range, not an arbitrary constant.
 */
export function peakAbsPnl(days: readonly DayStats[]): number {
  return days.reduce((max, d) => Math.max(max, Math.abs(d.netPnl)), 0);
}
