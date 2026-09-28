import { cn } from '@/utils/cn';

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src="/logo-light.png" alt="Trader's Workbook Logo" className="h-8 w-auto rounded-lg object-contain dark:hidden" />
      <img src="/logo-dark.png" alt="Trader's Workbook Logo" className="hidden h-8 w-auto rounded-lg object-contain dark:block" />
      {!compact && (
        <span className="text-sm font-semibold tracking-tight text-text">Trader&apos;s Workbook</span>
      )}
    </div>
  );
}
