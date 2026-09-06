import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { LoadingState } from '@/components/ui';

/** Gate for authenticated app routes. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const location = useLocation();

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <LoadingState label="Loading your workbook…" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Gate for admin-only routes (role-based). */
export function AdminRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <LoadingState />
      </div>
    );
  }
  if (!user) return <Navigate to={ROUTES.login} replace />;
  if (user.role !== 'admin') return <Navigate to={ROUTES.app} replace />;
  return <>{children}</>;
}
