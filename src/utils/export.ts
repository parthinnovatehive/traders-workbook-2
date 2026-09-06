import type { Trade } from '@/types';
import { computeTradeMetrics } from '@/calculations';

/** Escape a CSV cell (RFC 4180). */
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function tradesToCsv(trades: readonly Trade[], startingCapital: number): string {
  const header = [
    'Date',
    'Time',
    'Symbol',
    'Market',
    'Direction',
    'Entry',
    'Exit',
    'Quantity',
    'Stop',
    'Target',
    'Charges',
    'Gross P&L',
    'Net P&L',
    'R Multiple',
    'Status',
    'Strategy',
    'Setup',
    'Psychology',
    'Mistakes',
  ];
  const rows = trades.map((t) => {
    const m = computeTradeMetrics(t, { startingCapital });
    return [
      t.entryDate,
      t.entryTime ?? '',
      t.symbol,
      t.market,
      t.direction,
      t.entryPrice,
      t.exitPrice ?? '',
      t.quantity,
      t.stopLoss ?? '',
      t.target ?? '',
      t.charges,
      m.grossPnl ?? '',
      m.netPnl ?? '',
      m.rMultiple ?? '',
      m.status,
      t.strategyId ?? '',
      t.setup ?? '',
      t.psychology.join('|'),
      t.mistakes.join('|'),
    ].map(csvCell).join(',');
  });
  return [header.map(csvCell).join(','), ...rows].join('\n');
}

/** Trigger a client-side text download. */
export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
