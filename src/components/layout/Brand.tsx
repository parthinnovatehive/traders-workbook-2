import { cn } from '@/utils/cn';

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src="/logo-light.png" alt="Trader's Workbook Logo" className="h-10 w-auto object-contain dark:hidden" />
      <img src="/logo-dark.png" alt="Trader's Workbook Logo" className="hidden h-10 w-auto object-contain dark:block" />
    </div>
  );
}
