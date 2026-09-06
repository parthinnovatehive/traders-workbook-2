import type { TradingMode } from '@/types';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

const MODES: { value: TradingMode; label: string; short: string }[] = [
  { value: 'forex', label: 'Forex', short: 'FX' },
  { value: 'indian', label: 'Indian', short: 'IN' },
];

export function ModeToggle({ className }: { className?: string }) {
  const mode = useUiStore((s) => s.tradingMode);
  const setMode = useUiStore((s) => s.setTradingMode);

  return (
    <div
      role="tablist"
      aria-label="Trading mode"
      className={cn('flex items-center rounded-lg border border-border bg-surface p-0.5', className)}
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          role="tab"
          aria-selected={mode === m.value}
          type="button"
          onClick={() => setMode(m.value)}
          className={cn(
            'rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3',
            mode === m.value
              ? 'bg-primary text-primary-fg'
              : 'text-muted hover:bg-surface-2 hover:text-text',
          )}
        >
          <span className="hidden sm:inline">{m.label}</span>
          <span className="sm:hidden">{m.short}</span>
        </button>
      ))}
    </div>
  );
}
