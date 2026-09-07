import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import type { Feature } from '@/types';
import { ROUTES } from '@/constants/routes';
import { Button, Card, LoadingState } from '@/components/ui';
import { canAccessFeature } from '@/lib/entitlements';
import { useSubscription } from '@/hooks/useBilling';
import { usePlans } from '@/hooks/usePlans';

const MEMBERSHIP = ROUTES.membership;

export function FeatureLock({ title, description }: { title: string; description: string }) {
  return (
    <Card className="mx-auto mt-8 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{description}</p>
      <Link to={MEMBERSHIP} className="mt-6 inline-block">
        <Button>
          <Sparkles className="h-4 w-4" /> View Membership Plans
        </Button>
      </Link>
    </Card>
  );
}

/** Renders children when the feature is unlocked, otherwise a professional upgrade screen. */
export function FeatureGate({
  feature,
  title,
  description,
  children,
}: {
  feature: Feature;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const subscription = useSubscription();
  const plans = usePlans();
  if (subscription.isLoading || plans.isLoading) return <LoadingState />;
  const allowed = canAccessFeature(feature, subscription.data ?? null, plans.data ?? []);
  if (allowed) return <>{children}</>;
  return <FeatureLock title={title} description={description} />;
}
