import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { LoadingState } from '@/components/ui';
import { landingRouteFor } from './landing';

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

/**
 * Gate for the sign-in and sign-up pages.
 *
 * Someone already signed in has no business on them — showing a login form to a
 * logged-in user invites them to "log in again" and wonder why nothing happens.
 *
 * Deliberately NOT applied to `/reset-password`: opening a recovery link puts
 * the user into a real session, so this guard would bounce them away from the
 * very page that lets them set a new password.
 */
export function GuestRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);

  // Render nothing rather than a flash of the login form while the stored
  // session is still being restored.
  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <LoadingState />
      </div>
    );
  }
  if (user) return <Navigate to={landingRouteFor(user)} replace />;
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
