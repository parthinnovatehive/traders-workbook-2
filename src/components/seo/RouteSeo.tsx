import { useLocation } from 'react-router-dom';
import { NOT_FOUND, seoForPath } from '@/config/seo';
import { Seo } from './Seo';

/**
 * Metadata for whatever route is currently mounted, taken from the registry.
 *
 * Mounted once in each shell that wraps several routes — `AppShell`,
 * `AdminShell` and `AuthShell` — so all 25 authenticated, admin and auth routes
 * are covered by three lines of markup instead of 25 edits spread across 25
 * page components.
 *
 * That matters for correctness, not just tidiness. A page that forgot its own
 * `<Seo>` would silently keep the previous route's title *and* canonical, which
 * on a private page means pointing the canonical at somebody else's dashboard.
 * Deriving from `location.pathname` means the metadata cannot drift from the
 * route, and a path missing from the registry degrades to `noindex` rather than
 * to something indexable.
 *
 * Renders nothing visible.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const known = seoForPath(pathname);

  // The 404 wording is only a fallback for an unregistered path. Passing it
  // unconditionally would take priority over every real registry title, because
  // `resolve` prefers an explicit prop.
  return (
    <Seo
      path={pathname}
      title={known ? undefined : NOT_FOUND.title}
      description={known ? undefined : NOT_FOUND.description}
    />
  );
}
