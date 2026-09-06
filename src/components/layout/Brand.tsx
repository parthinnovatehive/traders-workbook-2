import { cn } from '@/utils/cn';

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-fg">
        TW
      </span>
      {!compact && (
        <span className="text-sm font-semibold tracking-tight text-text">Trader&apos;s Workbook</span>
      )}
    </div>
  );
}
