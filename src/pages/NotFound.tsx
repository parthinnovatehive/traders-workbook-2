import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { NOT_FOUND } from '@/config/seo';
import { Seo } from '@/components/seo';
import { Button } from '@/components/ui';
import { Brand } from '@/components/layout/Brand';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-4 text-center">
      {/*
        `noindex, nofollow` on every unmatched URL. A mistyped or retired path
        otherwise gets indexed as a thin duplicate of a real page, and this
        component answers for all of them at once.

        The canonical points home rather than at the 404 URL itself: the page
        invites you to go there, and a canonical should name the page that the
        content belongs to. The noindex is what keeps the URL itself out.
      */}
      <Seo path={ROUTES.home} title={NOT_FOUND.title} description={NOT_FOUND.description} />
      <Brand />
      <div>
        <h1 className="text-5xl font-bold text-text">404</h1>
        <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist.</p>
      </div>
      <Link to={ROUTES.home}>
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}
