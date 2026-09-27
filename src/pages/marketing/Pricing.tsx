import { Link } from 'react-router-dom';
import { PERIOD_SUFFIX } from '@/lib/pricing';
import { Check } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Badge, Button, LoadingState } from '@/components/ui';
import { Seo, breadcrumbSchema, softwareApplicationSchema, webPageSchema, MARKETING_TRAIL } from '@/components/seo';
import { usePlans } from '@/hooks/usePlans';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

const PAGE = {
  path: ROUTES.pricing,
  name: 'Pricing',
  description:
    'Start free with 30 trades. Pro and Elite add unlimited trades, advanced analytics, risk tools and the Hall of Fame. See exactly what each plan includes.',
};

export default function Pricing() {
  const plans = usePlans();
  // The `offers` in the SoftwareApplication schema are built from the same rows
  // this page renders, so an admin price change is reflected in the markup
  // without a redeploy instead of quietly going stale.
  const activePlans = (plans.data ?? []).filter((plan) => plan.isActive);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <Seo
        path={PAGE.path}
        schema={[
          webPageSchema({ name: PAGE.name, description: PAGE.description, path: PAGE.path }),
          breadcrumbSchema([...MARKETING_TRAIL, { name: PAGE.name, path: PAGE.path }]),
          // `null` until the plans query resolves, so no empty `offers` array is
          // published in the meantime.
          activePlans.length > 0 ? softwareApplicationSchema(activePlans) : null,
        ]}
      />

      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">Simple, honest pricing</h1>
        <p className="mt-4 text-muted">Start free. Upgrade when your trading demands more.</p>
      </div>

      {plans.isLoading ? (
        <LoadingState />
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {(plans.data ?? [])
            .filter((p) => p.isActive)
            .map((plan) => {
              const featured = plan.code === 'PRO';
              return (
                <div
                  key={plan.id}
                  className={cn(
                    'flex flex-col rounded-card border bg-surface p-6',
                    featured ? 'border-primary shadow-lg ring-1 ring-primary/30' : 'border-border',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-text">{plan.name}</h2>
                    {featured && <Badge tone="primary">Most popular</Badge>}
                  </div>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-bold tracking-tight text-text">
                      {plan.price === 0 ? 'Free' : formatCurrency(plan.price, plan.currency, { dp: 0 })}
                    </span>
                    {plan.price > 0 && <span className="mb-1 text-sm text-muted">/ {PERIOD_SUFFIX[plan.billingPeriod]}</span>}
                  </div>

                  <ul className="mt-6 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-text">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-profit" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link to={ROUTES.register} className="mt-6">
                    <Button variant={featured ? 'primary' : 'outline'} className="w-full">
                      {plan.price === 0 ? 'Get started' : `Choose ${plan.name}`}
                    </Button>
                  </Link>
                </div>
              );
            })}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-muted">
        Prices are managed centrally and can be updated by the team at any time.
      </p>
    </div>
  );
}
