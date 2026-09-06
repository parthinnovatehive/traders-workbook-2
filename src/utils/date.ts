import dayjs from 'dayjs';
import type { ISODate } from '@/types';

export const DATE_PRESETS = ['today', 'week', 'month', 'year', 'all', 'custom'] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  all: 'All Time',
  custom: 'Custom',
};

export interface DateRange {
  start: ISODate | null; // null = unbounded
  end: ISODate | null;
}

export function todayISO(): ISODate {
  return dayjs().format('YYYY-MM-DD');
}

export function formatDate(iso: ISODate | undefined, fmt = 'MMM D, YYYY'): string {
  if (!iso) return '—';
  const d = dayjs(iso);
  return d.isValid() ? d.format(fmt) : '—';
}

export function monthKey(iso: ISODate): string {
  return dayjs(iso).format('YYYY-MM');
}

export function monthLabel(key: string): string {
  return dayjs(`${key}-01`).format("MMM 'YY");
}

/** Resolve a preset (relative to now) into a concrete date range. */
export function resolvePreset(preset: DatePreset, custom?: DateRange): DateRange {
  const now = dayjs();
  switch (preset) {
    case 'today':
      return { start: now.format('YYYY-MM-DD'), end: now.format('YYYY-MM-DD') };
    case 'week':
      return { start: now.startOf('week').format('YYYY-MM-DD'), end: now.endOf('week').format('YYYY-MM-DD') };
    case 'month':
      return { start: now.startOf('month').format('YYYY-MM-DD'), end: now.endOf('month').format('YYYY-MM-DD') };
    case 'year':
      return { start: now.startOf('year').format('YYYY-MM-DD'), end: now.endOf('year').format('YYYY-MM-DD') };
    case 'custom':
      return custom ?? { start: null, end: null };
    case 'all':
    default:
      return { start: null, end: null };
  }
}

/** Is an ISO date within [start, end] (inclusive, null = unbounded)? */
export function isWithin(iso: ISODate | undefined, range: DateRange): boolean {
  if (!iso) return false;
  if (range.start && iso < range.start) return false;
  if (range.end && iso > range.end) return false;
  return true;
}

/** Hour of day (0-23) from an ISO time 'HH:mm'; null if absent/invalid. */
export function hourOf(time: string | undefined): number | null {
  if (!time) return null;
  const parts = time.split(':');
  const h = Number(parts[0]);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
}
