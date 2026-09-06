import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Badge, Button, LoadingState } from '@/components/ui';
import { usePlans } from '@/hooks/usePlans';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

export default function Pricing() {
  const plans = usePlans();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
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
                    <h3 className="text-lg font-semibold text-text">{plan.name}</h3>
                    {featured && <Badge tone="primary">Most popular</Badge>}
                  </div>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-bold tracking-tight text-text">
                      {plan.price === 0 ? 'Free' : formatCurrency(plan.price, plan.currency, { dp: 0 })}
                    </span>
                    {plan.price > 0 && <span className="mb-1 text-sm text-muted">/ {plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>}
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
