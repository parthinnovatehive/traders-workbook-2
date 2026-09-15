import { useState } from 'react';
import type { Plan } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  LoadingState,
  Textarea,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePlans, useUpdatePlan } from '@/hooks/usePlans';
import { toast } from '@/store/toastStore';
import { formatCurrency } from '@/utils/format';

export default function AdminPlans() {
  const plans = usePlans();

  if (plans.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Plans & Pricing"
        subtitle="What each tier costs and what it unlocks."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(plans.data ?? []).map((plan) => (
          <PlanEditor key={plan.id} plan={plan} />
        ))}
      </div>
    </>
  );
}

function PlanEditor({ plan }: { plan: Plan }) {
  const updatePlan = useUpdatePlan();
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [maxTrades, setMaxTrades] = useState(String(plan.limits.maxTrades ?? -1));
  const [features, setFeatures] = useState(plan.features.join('\n'));
  const [active, setActive] = useState(plan.isActive);

  const save = () => {
    updatePlan.mutate(
      {
        id: plan.id,
        patch: {
          name: name.trim() || plan.name,
          price: Number(price) || 0,
          isActive: active,
          features: features
            .split('\n')
            .map((f) => f.trim())
            .filter(Boolean),
          limits: { ...plan.limits, maxTrades: Number(maxTrades) },
        },
      },
      {
        onSuccess: () => toast.success(`${plan.name} updated.`),
        onError: () => toast.error('Could not update the plan.'),
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title={plan.name}
        description={`${plan.code} · ${plan.billingPeriod}`}
        action={<Badge tone={active ? 'profit' : 'neutral'}>{active ? 'Visible' : 'Hidden'}</Badge>}
      />
      <CardBody className="space-y-3">
        <Field label="Display name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Price (${plan.currency})`}>
            <Input type="number" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Trade limit" hint="-1 = unlimited">
            <Input type="number" value={maxTrades} onChange={(e) => setMaxTrades(e.target.value)} />
          </Field>
        </div>

        <Field label="Features" hint="One per line — shown on the pricing page">
          <Textarea
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            className="min-h-28"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-primary"
          />
          Visible on the pricing page
        </label>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted">
            {formatCurrency(Number(price), plan.currency)} /{' '}
            {plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}
          </span>
          <Button size="sm" loading={updatePlan.isPending} onClick={save}>
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
