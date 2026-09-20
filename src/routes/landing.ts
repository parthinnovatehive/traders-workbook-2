import type { User } from '@/types';
import { ROUTES } from '@/constants/routes';

/**
 * Where a signed-in user belongs.
 *
 * One decision in one place. Login, Register and ResetPassword each used to
 * hardcode `navigate(ROUTES.app)`, which meant three copies of a rule that was
 * already wrong for admins and would have drifted the moment a fourth entry
 * point appeared.
 */

/** The home screen for this user: admins manage the platform, traders trade. */
export function landingRouteFor(user: Pick<User, 'role'> | null | undefined): string {
  return user?.role === 'admin' ? ROUTES.admin : ROUTES.app;
}

/**
 * Only in-app paths are accepted as a post-login destination, and only ones the
 * user may actually reach. Anything else — an external URL, a protocol-relative
 * `//evil.com`, or a plain trader deep-linking into `/admin` — falls back to
 * their landing route rather than bouncing them through a guard.
 */
export function resolvePostAuthRoute(
  user: Pick<User, 'role'> | null | undefined,
  from?: unknown,
): string {
  const landing = landingRouteFor(user);

  if (typeof from !== 'string') return landing;
  // Must be a single-slash absolute path within this app.
  if (!from.startsWith('/') || from.startsWith('//')) return landing;

  const isAppPath = from === ROUTES.app || from.startsWith(`${ROUTES.app}/`);
  const isAdminPath = from === ROUTES.admin || from.startsWith(`${ROUTES.admin}/`);

  if (isAdminPath) return user?.role === 'admin' ? from : landing;
  if (isAppPath) return from;

  // Marketing and auth pages are not somewhere to land after signing in.
  return landing;
}
