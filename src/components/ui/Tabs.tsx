import { cn } from '@/utils/cn';

export interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1', className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === item.value
              ? 'bg-primary text-primary-fg'
              : 'text-muted hover:bg-surface-2 hover:text-text',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
