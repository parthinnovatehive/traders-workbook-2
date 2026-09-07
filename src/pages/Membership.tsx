import { PageHeader } from '@/components/layout/PageHeader';
import { MembershipPanel } from '@/components/billing/MembershipPanel';

export default function Membership() {
  return (
    <>
      <PageHeader title="Membership" subtitle="Manage your membership, plans, and billing." />
      <MembershipPanel />
    </>
  );
}
