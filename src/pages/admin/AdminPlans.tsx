import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Info, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import type { BillingPeriod, Feature, Plan, PlanDraft } from '@/types';
import { BILLING_PERIODS, FEATURES } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  LoadingState,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { FEATURE_META, PLAN_LIMIT_FIELDS } from '@/config/plans';
import { useCreatePlan, useDeletePlan, usePlans, useUpdatePlan } from '@/hooks/usePlans';
import { useAdminSubscriptions } from '@/hooks/useAdmin';
import {
  derivePlanId,
  toPlanPatch,
  validatePlanForm,
  type PlanFormValues,
} from '@/lib/planAdmin';
import {
  PERIOD_LABEL,
  impliedDiscountPercent,
  monthlyPlanFor,
  priceFromMonthly,
} from '@/lib/pricing';
import { toast } from '@/store/toastStore';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

const BLANK_LIMITS = (): Record<string, number | boolean> => {
  const limits: Record<string, number | boolean> = { maxTrades: -1, customStrategies: -1 };
  for (const f of FEATURES) limits[f] = false;
  return limits;
};

function toForm(plan: Plan): PlanFormValues {
  return {
    code: plan.code,
    name: plan.name,
    price: String(plan.price),
    currency: plan.currency,
    billingPeriod: plan.billingPeriod,
    sortOrder: String(plan.sortOrder),
    discountPercent: String(plan.discountPercent ?? 0),
    features: plan.features,
    limits: { ...plan.limits },
    isActive: plan.isActive,
  };
}

export default function AdminPlans() {
  const plans = usePlans();
  const subs = useAdminSubscriptions();
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => plans.data ?? [], [plans.data]);

  /** Subscribers per plan — what makes "can I delete this?" answerable. */
  const subscriberCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subs.data ?? []) map.set(s.planId, (map.get(s.planId) ?? 0) + 1);
    return map;
  }, [subs.data]);

  if (plans.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Plans & Pricing"
        subtitle="What each tier costs, what it unlocks, and who can see it."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Add plan
          </Button>
        }
      />

      {all.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">
              No plans yet. Add one — remember that a plan with the code{' '}
              <code className="text-text">FREE</code> must exist, because every new signup is placed
              on it.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {all.map((plan) => (
          <PlanEditor
            key={plan.id}
            plan={plan}
            allPlans={all}
            subscribers={subscriberCount.get(plan.id) ?? 0}
          />
        ))}
      </div>

      {creating && <CreatePlanModal allPlans={all} onClose={() => setCreating(false)} />}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

function PlanEditor({
  plan,
  allPlans,
  subscribers,
}: {
  plan: Plan;
  allPlans: readonly Plan[];
  subscribers: number;
}) {
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const [values, setValues] = useState<PlanFormValues>(() => toForm(plan));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const setLimit = (key: string, value: number | boolean) =>
    setValues((v) => ({ ...v, limits: { ...v.limits, [key]: value } }));

  const baseline = useMemo(() => toForm(plan), [plan]);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  const { errors, warnings } = validatePlanForm(values, allPlans, {
    isNew: false,
    originalId: plan.id,
  });

  const save = () => {
    if (errors.length > 0) return;
    updatePlan.mutate(
      { id: plan.id, patch: toPlanPatch(values) },
      {
        onSuccess: () => toast.success(`${values.name.trim()} updated.`),
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not update the plan.'),
      },
    );
  };

  const remove = () => {
    deletePlan.mutate(plan.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        toast.success(`${plan.name} deleted.`);
      },
      onError: (e) => {
        setConfirmDelete(false);
        toast.error(e instanceof Error ? e.message : 'Could not delete the plan.');
      },
    });
  };

  const isOnlyFree = plan.code === 'FREE' && !allPlans.some((p) => p.code === 'FREE' && p.id !== plan.id);
  const deletable = subscribers === 0 && !isOnlyFree;

  return (
    <Card>
      <CardHeader
        title={plan.name}
        description={`${plan.code} · ${plan.billingPeriod} · ${plan.id}`}
        action={
          <div className="flex items-center gap-2">
            {subscribers > 0 && (
              <Badge tone="info">
                <Users className="mr-1 inline h-3 w-3" />
                {subscribers}
              </Badge>
            )}
            {dirty && <Badge tone="warning">Unsaved</Badge>}
            <Badge tone={values.isActive ? 'profit' : 'neutral'}>
              {values.isActive ? 'Visible' : 'Hidden'}
            </Badge>
          </div>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Display name">
            <Input value={values.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Code" hint={isOnlyFree ? 'Locked — signups depend on it' : 'Tier key'}>
            <Input
              value={values.code}
              disabled={isOnlyFree}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Price">
            <Input
              type="number"
              step="any"
              min="0"
              value={values.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <Input
              value={values.currency}
              maxLength={3}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Billing">
            <Select
              value={values.billingPeriod}
              onChange={(e) => set('billingPeriod', e.target.value as BillingPeriod)}
            >
              {BILLING_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sort order" hint="Low first">
            <Input
              type="number"
              value={values.sortOrder}
              onChange={(e) => set('sortOrder', e.target.value)}
            />
          </Field>
        </div>

        <DiscountRow
          values={values}
          allPlans={allPlans}
          onApply={(price) => set('price', price)}
          onChange={(d) => set('discountPercent', d)}
        />

        {/* Numeric allowances */}
        <div className="grid grid-cols-2 gap-3">
          {PLAN_LIMIT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <Input
                type="number"
                value={String(values.limits[f.key] ?? -1)}
                onChange={(e) => setLimit(f.key, Number(e.target.value))}
              />
            </Field>
          ))}
        </div>

        {/* The ask: one checkbox per gateable feature. */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Included features
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <FeatureToggle
                key={feature}
                feature={feature}
                checked={values.limits[feature] === true}
                onChange={(next) => setLimit(feature, next)}
              />
            ))}
          </div>
        </div>

        <Field label="Marketing copy" hint="One bullet per line — shown on the pricing page">
          <Textarea
            value={values.features.join('\n')}
            onChange={(e) => set('features', e.target.value.split('\n'))}
            className="min-h-24"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            className="accent-primary"
          />
          Visible on the pricing page
        </label>

        <Notices errors={errors} warnings={warnings} />

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!deletable || deletePlan.isPending}
              title={
                isOnlyFree
                  ? 'The last FREE plan cannot be deleted — new signups are placed on it.'
                  : subscribers > 0
                    ? `${subscribers} subscriber(s) on this plan. Hide it instead.`
                    : undefined
              }
              onClick={() => setConfirmDelete(true)}
              className={cn(deletable && 'text-loss hover:bg-loss/10')}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            {dirty && (
              <Button variant="ghost" size="sm" onClick={() => setValues(baseline)}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              {formatCurrency(Number(values.price) || 0, values.currency || 'INR')} /{' '}
              {values.billingPeriod === 'monthly' ? 'mo' : 'yr'}
            </span>
            <Button
              size="sm"
              loading={updatePlan.isPending}
              disabled={!dirty || errors.length > 0}
              onClick={save}
            >
              Save
            </Button>
          </div>
        </div>
      </CardBody>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${plan.name}?`}
        size="md"
      >
        <p className="text-sm text-text">
          This removes the plan permanently. Nobody is subscribed to it, so no one loses access —
          but any billing history referencing it keeps the plan id.
        </p>
        <p className="mt-2 text-sm text-muted">
          If you only want it off the pricing page, cancel and untick “Visible” instead.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button variant="danger" loading={deletePlan.isPending} onClick={remove}>
            Delete plan
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

/**
 * A flag with no enforcement point is shown but locked off.
 *
 * Letting an admin tick "AI insights" would put it in a plan that grants
 * nothing — the plan page would be advertising something the code never checks.
 */
function FeatureToggle({
  feature,
  checked,
  onChange,
}: {
  feature: Feature;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const meta = FEATURE_META[feature];
  const always = meta.enforcedIn === 'always on';
  const unbuilt = meta.enforcedIn === null;

  return (
    <label
      className={cn(
        'flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm',
        unbuilt || always ? 'opacity-60' : 'cursor-pointer hover:bg-surface-2',
      )}
      title={meta.description}
    >
      <input
        type="checkbox"
        checked={always ? true : checked}
        disabled={unbuilt || always}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-primary"
      />
      <span className="min-w-0">
        <span className="block truncate text-text">{meta.label}</span>
        <span className="block truncate text-[11px] text-muted">
          {unbuilt ? 'Not built yet — grants nothing' : always ? 'Always included' : meta.description}
        </span>
      </span>
    </label>
  );
}

function Notices({ errors, warnings }: { errors: string[]; warnings: string[] }) {
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {errors.map((e) => (
        <p key={e} className="flex items-start gap-1.5 text-xs text-loss">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {e}
        </p>
      ))}
      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-xs text-warning">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {w}
        </p>
      ))}
    </div>
  );
}

/**
 * Discount against the tier's monthly price.
 *
 * The computed figure is written into `price` rather than derived at render
 * time, because `create_payment_order` charges whatever `price` says. A price
 * calculated on the way to the gateway is a price that can disagree with the
 * one the customer was shown.
 */
function DiscountRow({
  values,
  allPlans,
  onApply,
  onChange,
}: {
  values: PlanFormValues;
  allPlans: readonly Plan[];
  onApply: (price: string) => void;
  onChange: (discount: string) => void;
}) {
  if (values.billingPeriod === 'monthly') {
    return (
      <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
        Monthly is the baseline. Quarterly and yearly plans for{' '}
        <span className="text-text">{values.code || 'this tier'}</span> are priced as a discount off
        this figure.
      </p>
    );
  }

  const code = values.code.trim().toUpperCase();
  const base = monthlyPlanFor(code, allPlans);
  const discount = Number(values.discountPercent) || 0;
  const price = Number(values.price) || 0;
  const expected = base ? priceFromMonthly(base.price, values.billingPeriod, discount) : null;
  const actual = base && base.price > 0 ? impliedDiscountPercent(base.price, price, values.billingPeriod) : null;
  const drifted = expected !== null && Math.abs(expected - price) > 1;

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Discount vs monthly" hint="%">
          <Input
            type="number"
            min="0"
            max="99"
            className="w-24"
            value={values.discountPercent}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
        {base ? (
          <>
            <p className="mb-2 text-xs text-muted">
              {formatCurrency(base.price, values.currency || 'INR', { dp: 0 })} × {' '}
              {values.billingPeriod === 'yearly' ? 12 : 3} − {discount}% ={' '}
              <span className="text-text">
                {expected === null ? '—' : formatCurrency(expected, values.currency || 'INR', { dp: 0 })}
              </span>
              {actual !== null && ` · current price is ${actual}% off`}
            </p>
            {expected !== null && drifted && (
              <Button
                variant="secondary"
                size="sm"
                className="mb-2"
                onClick={() => onApply(String(expected))}
              >
                <Calculator className="h-3.5 w-3.5" />
                Apply discount
              </Button>
            )}
          </>
        ) : (
          <p className="mb-2 text-xs text-warning">
            No {code} monthly plan — nothing to discount against.
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

function CreatePlanModal({ allPlans, onClose }: { allPlans: readonly Plan[]; onClose: () => void }) {
  const createPlan = useCreatePlan();
  const [values, setValues] = useState<PlanFormValues>({
    code: 'STARTER',
    name: 'Starter',
    price: '499',
    currency: allPlans[0]?.currency ?? 'INR',
    billingPeriod: 'monthly',
    sortOrder: String(allPlans.length + 1),
    discountPercent: '0',
    features: [],
    limits: BLANK_LIMITS(),
    isActive: false,
    });

  const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setLimit = (key: string, value: number | boolean) =>
    setValues((v) => ({ ...v, limits: { ...v.limits, [key]: value } }));

  const { errors, warnings } = validatePlanForm(values, allPlans, { isNew: true });
  const id = derivePlanId(values.code.trim().toUpperCase() || 'X', values.billingPeriod);

  const create = () => {
    if (errors.length > 0) return;
    const draft: PlanDraft = {
      ...toPlanPatch(values),
      code: values.code.trim().toUpperCase(),
      id,
    };
    createPlan.mutate(draft, {
      onSuccess: (p) => {
        toast.success(`${p.name} created. It stays hidden until you tick “Visible”.`);
        onClose();
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create the plan.'),
    });
  };

  return (
    <Modal open onClose={onClose} title="Add a plan" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Display name">
            <Input value={values.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>
          <Field label="Code" hint="Uppercase tier key">
            <Input
              value={values.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Price">
            <Input
              type="number"
              step="any"
              min="0"
              value={values.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <Input
              value={values.currency}
              maxLength={3}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Billing">
            <Select
              value={values.billingPeriod}
              onChange={(e) => set('billingPeriod', e.target.value as BillingPeriod)}
            >
              {BILLING_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              value={values.sortOrder}
              onChange={(e) => set('sortOrder', e.target.value)}
            />
          </Field>
        </div>

        <DiscountRow
          values={values}
          allPlans={allPlans}
          onApply={(price) => set('price', price)}
          onChange={(d) => set('discountPercent', d)}
        />


        <div className="grid grid-cols-2 gap-3">
          {PLAN_LIMIT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <Input
                type="number"
                value={String(values.limits[f.key] ?? -1)}
                onChange={(e) => setLimit(f.key, Number(e.target.value))}
              />
            </Field>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Included features
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <FeatureToggle
                key={feature}
                feature={feature}
                checked={values.limits[feature] === true}
                onChange={(next) => setLimit(feature, next)}
              />
            ))}
          </div>
        </div>

        <Field label="Marketing copy" hint="One bullet per line">
          <Textarea
            value={values.features.join('\n')}
            onChange={(e) => set('features', e.target.value.split('\n'))}
            className="min-h-20"
          />
        </Field>

        <p className="text-xs text-muted">
          Will be created as <code className="text-text">{id}</code>, hidden from the pricing page
          until you make it visible.
        </p>

        <Notices errors={errors} warnings={warnings} />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={createPlan.isPending} disabled={errors.length > 0} onClick={create}>
          Create plan
        </Button>
      </div>
    </Modal>
  );
}
