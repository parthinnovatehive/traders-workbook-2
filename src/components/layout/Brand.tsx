import { cn } from '@/utils/cn';

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src="/logo.jpeg" alt="Trader's Workbook Logo" className="h-8 w-auto rounded-lg object-contain" />
      {!compact && (
        <span className="text-sm font-semibold tracking-tight text-text">Trader&apos;s Workbook</span>
      )}
    </div>
  );
}
