import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Brand } from '@/components/layout/Brand';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link to={ROUTES.home}>
            <Brand />
          </Link>
        </div>
        <div className="rounded-card border border-border bg-surface p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-4 text-center text-sm text-muted">{footer}</div>
      </div>
    </div>
  );
}
