import type { EquityPoint, ISODate, Trade } from '@/types';
import { hourOf, monthKey, monthLabel } from '@/utils/date';
import { roundMoney, roundTo } from '@/utils/money';
import { buildEquityCurve } from './drawdown';
import { closedTradesInOrder } from './performance';
import { netPnl } from './pnl';
import { rMultiple } from './rmultiple';

/** Equity curve (running capital) with dates, for the dashboard chart. */
export function equitySeries(trades: readonly Trade[], startingCapital: number): EquityPoint[] {
  const closed = closedTradesInOrder(trades);
  const nets = closed.map((t) => netPnl(t) ?? 0);
  const dates = closed.map((t) => t.exitDate ?? t.entryDate);
  return buildEquityCurve(nets, startingCapital, dates);
}

export interface DailyPnlPoint {
  date: ISODate;
  netPnl: number;
  trades: number;
}

/** Net P&L grouped by calendar day (realization date). */
export function dailyPnlSeries(trades: readonly Trade[]): DailyPnlPoint[] {
  const map = new Map<ISODate, { net: number; count: number }>();
  for (const t of closedTradesInOrder(trades)) {
    const key = t.exitDate ?? t.entryDate;
    const net = netPnl(t) ?? 0;
    const cur = map.get(key) ?? { net: 0, count: 0 };
    cur.net += net;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([date, v]) => ({ date, netPnl: roundMoney(v.net), trades: v.count }))
    .toSorted((a, b) => a.date.localeCompare(b.date));
}

export interface MonthlyPnlPoint {
  month: string; // 'YYYY-MM'
  label: string;
  netPnl: number;
  trades: number;
}

export function monthlyPnlSeries(trades: readonly Trade[]): MonthlyPnlPoint[] {
  const map = new Map<string, { net: number; count: number }>();
  for (const t of closedTradesInOrder(trades)) {
    const key = monthKey(t.exitDate ?? t.entryDate);
    const net = netPnl(t) ?? 0;
    const cur = map.get(key) ?? { net: 0, count: 0 };
    cur.net += net;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([month, v]) => ({ month, label: monthLabel(month), netPnl: roundMoney(v.net), trades: v.count }))
    .toSorted((a, b) => a.month.localeCompare(b.month));
}

export interface WinLossDistribution {
  wins: number;
  losses: number;
  breakevens: number;
}

export function winLossDistribution(trades: readonly Trade[]): WinLossDistribution {
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  for (const t of closedTradesInOrder(trades)) {
    const net = netPnl(t) ?? 0;
    if (net > 0) wins += 1;
    else if (net < 0) losses += 1;
    else breakevens += 1;
  }
  return { wins, losses, breakevens };
}

export interface RBucket {
  bucket: string;
  count: number;
  from: number;
}

/** Histogram of R multiples in unit-width buckets. */
export function rMultipleDistribution(trades: readonly Trade[]): RBucket[] {
  const buckets = new Map<number, number>();
  for (const t of closedTradesInOrder(trades)) {
    const r = rMultiple(t);
    if (r === null) continue;
    const floor = Math.floor(r);
    buckets.set(floor, (buckets.get(floor) ?? 0) + 1);
  }
  if (buckets.size === 0) return [];
  const floors = [...buckets.keys()];
  const min = Math.min(...floors);
  const max = Math.max(...floors);
  const rows: RBucket[] = [];
  for (let f = min; f <= max; f += 1) {
    rows.push({ from: f, bucket: `${f >= 0 ? '+' : ''}${f}R`, count: buckets.get(f) ?? 0 });
  }
  return rows;
}

export interface TimeOfDayPoint {
  hour: number;
  label: string;
  netPnl: number;
  trades: number;
  avgR: number | null;
}

/** Performance by hour of entry (Section 8 / 18). */
export function timeOfDaySeries(trades: readonly Trade[]): TimeOfDayPoint[] {
  const map = new Map<number, { net: number; count: number; rs: number[] }>();
  for (const t of closedTradesInOrder(trades)) {
    const h = hourOf(t.entryTime);
    if (h === null) continue;
    const net = netPnl(t) ?? 0;
    const cur = map.get(h) ?? { net: 0, count: 0, rs: [] };
    cur.net += net;
    cur.count += 1;
    const r = rMultiple(t);
    if (r !== null) cur.rs.push(r);
    map.set(h, cur);
  }
  return [...map.entries()]
    .map(([hour, v]) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      netPnl: roundMoney(v.net),
      trades: v.count,
      avgR: v.rs.length > 0 ? roundTo(v.rs.reduce((a, b) => a + b, 0) / v.rs.length, 2) : null,
    }))
    .toSorted((a, b) => a.hour - b.hour);
}
