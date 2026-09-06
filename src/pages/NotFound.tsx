import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui';
import { Brand } from '@/components/layout/Brand';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-4 text-center">
      <Brand />
      <div>
        <p className="text-5xl font-bold text-text">404</p>
        <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist.</p>
      </div>
      <Link to={ROUTES.home}>
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}
