import { DATE_PRESET_LABELS, DATE_PRESETS } from '@/utils/date';
import { useDateFilter } from '@/hooks/useDateFilter';
import { cn } from '@/utils/cn';
import { Input } from '@/components/ui';

export function DateFilter() {
  const { preset, range, setDatePreset, setCustomRange } = useDateFilter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {DATE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setDatePreset(p)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              preset === p ? 'bg-primary text-primary-fg' : 'text-muted hover:bg-surface-2 hover:text-text',
            )}
          >
            {DATE_PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="h-8 w-auto py-1 text-xs"
            value={range.start ?? ''}
            onChange={(e) => setCustomRange({ start: e.target.value || null, end: range.end })}
          />
          <span className="text-xs text-muted">to</span>
          <Input
            type="date"
            className="h-8 w-auto py-1 text-xs"
            value={range.end ?? ''}
            onChange={(e) => setCustomRange({ start: range.start, end: e.target.value || null })}
          />
        </div>
      )}
    </div>
  );
}
