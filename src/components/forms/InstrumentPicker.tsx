import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Star } from 'lucide-react';
import type { InstrumentCategory, TradingMode } from '@/types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/types';
import { useInstrumentOptions, useToggleFavourite, type InstrumentOption } from '@/hooks/useInstruments';
import { cn } from '@/utils/cn';

interface Props {
  tradingMode: TradingMode;
  value: string;
  onChange: (symbol: string, option?: InstrumentOption) => void;
  autoFocus?: boolean;
  id?: string;
}

/** An option plus its position in the flattened list, for keyboard navigation. */
interface IndexedOption {
  option: InstrumentOption;
  index: number;
}

interface Group {
  key: string;
  label: string;
  items: IndexedOption[];
}

/** Matches symbol or company name, so "bank" finds HDFCBANK and BANKNIFTY. */
function matches(option: InstrumentOption, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return option.symbol.toLowerCase().includes(q) || option.name.toLowerCase().includes(q);
}

/**
 * Ranks an exact symbol match first, then a symbol prefix, then anything else —
 * typing "TCS" should not put "TCSFOODS" above "TCS".
 */
function rank(option: InstrumentOption, query: string): number {
  if (!query) return 2;
  const q = query.toLowerCase();
  const symbol = option.symbol.toLowerCase();
  if (symbol === q) return 0;
  if (symbol.startsWith(q)) return 1;
  return 2;
}

/**
 * Searchable instrument dropdown with per-user favourites, in the style of a
 * trading terminal: starred symbols are pinned to the top so a trader hits
 * their handful of daily instruments without scrolling ~500 names.
 */
export function InstrumentPicker({ tradingMode, value, onChange, autoFocus, id }: Props) {
  const { options, isLoading } = useInstrumentOptions(tradingMode);
  const toggleFavourite = useToggleFavourite();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.symbol === value), [options, value]);

  /** Visible options in render order: favourites first, then by category. */
  const { groups, flat } = useMemo(() => {
    const visible = options
      .filter((o) => matches(o, query))
      .toSorted((a, b) => rank(a, query) - rank(b, query) || a.sortOrder - b.sortOrder);

    const favourites = visible.filter((o) => o.isFavourite);
    const rest = visible.filter((o) => !o.isFavourite);

    const byCategory = new Map<string, InstrumentOption[]>();
    for (const option of rest) {
      const key = option.category ?? 'other';
      const list = byCategory.get(key);
      if (list) list.push(option);
      else byCategory.set(key, [option]);
    }

    const ordered: { key: string; label: string; items: InstrumentOption[] }[] = [];
    if (favourites.length > 0) {
      ordered.push({ key: 'favourites', label: 'Favourites', items: favourites });
    }
    for (const category of CATEGORY_ORDER) {
      const items = byCategory.get(category);
      if (items?.length) {
        ordered.push({
          key: category,
          label: CATEGORY_LABELS[category as InstrumentCategory],
          items,
        });
      }
    }
    const other = byCategory.get('other');
    if (other?.length) ordered.push({ key: 'other', label: 'Other', items: other });

    // Assign flat indices here rather than counting during render — mutating a
    // counter while rendering breaks on re-entrant renders.
    const flatList: InstrumentOption[] = [];
    const result: Group[] = ordered.map((group) => ({
      key: group.key,
      label: group.label,
      items: group.items.map((option) => {
        const index = flatList.length;
        flatList.push(option);
        return { option, index };
      }),
    }));

    return { groups: result, flat: flatList };
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  // Close on an outside click or Escape — a dropdown that traps focus over a
  // long form is worse than no dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  });

  const choose = (option: InstrumentOption) => {
    onChange(option.symbol, option);
    setOpen(false);
    setQuery('');
  };

  const onStar = (e: React.MouseEvent, option: InstrumentOption) => {
    // Starring must not also select the row and close the dropdown.
    e.stopPropagation();
    e.preventDefault();
    toggleFavourite.mutate({
      tradingMode,
      symbol: option.symbol,
      isFavourite: option.isFavourite,
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const option = flat[activeIndex];
      if (option) choose(option);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        autoFocus={autoFocus}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-left text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.isFavourite && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />
          )}
          <span className="truncate font-medium text-text">{value || 'Select an instrument'}</span>
          {selected && (
            <span className="hidden truncate text-xs text-muted sm:inline">{selected.name}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        // Key handling lives on the popover, not the input, so arrows and Enter
        // still work if focus moves to a row or the star button.
        <div
          onKeyDown={onKeyDown}
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // Narrowing the list invalidates the highlighted row.
                setActiveIndex(0);
              }}
              placeholder={tradingMode === 'forex' ? 'Search pairs…' : 'Search stocks & indices…'}
              className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            />
          </div>

          <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {isLoading && <p className="px-3 py-6 text-center text-xs text-muted">Loading…</p>}

            {!isLoading && flat.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted">
                No instrument matches “{query}”.
              </p>
            )}

            {groups.map((group) => (
              <div key={group.key}>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {group.label}
                </p>
                {group.items.map(({ option, index }) => {
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={`${group.key}:${option.id}`}
                      role="option"
                      aria-selected={option.symbol === value}
                      data-active={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(option)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm',
                        isActive ? 'bg-surface-2' : 'bg-transparent',
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => onStar(e, option)}
                        aria-label={
                          option.isFavourite
                            ? `Remove ${option.symbol} from favourites`
                            : `Add ${option.symbol} to favourites`
                        }
                        className="shrink-0 rounded p-0.5 text-muted hover:text-warning"
                      >
                        <Star
                          className={cn(
                            'h-3.5 w-3.5',
                            option.isFavourite && 'fill-warning text-warning',
                          )}
                        />
                      </button>
                      <span className="w-28 shrink-0 truncate font-medium text-text">
                        {option.symbol}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">
                        {option.name}
                      </span>
                      {option.exchange && (
                        <span className="shrink-0 text-[10px] uppercase text-muted">
                          {option.alsoOn.length > 0
                            ? `${option.exchange}·${option.alsoOn.join('·')}`
                            : option.exchange}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
