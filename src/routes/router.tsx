import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { LoadingState } from '@/components/ui';
import { AppShell } from '@/components/layout/AppShell';
import { AdminShell } from '@/components/layout/AdminShell';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { AdminRoute, GuestRoute, ProtectedRoute } from './guards';

// Lazy-loaded routes → each page becomes its own chunk, keeping the initial
// (marketing/auth) load small and deferring heavy chart code until needed.
const Home = lazy(() => import('@/pages/marketing/Home'));
const Features = lazy(() => import('@/pages/marketing/Features'));
const Pricing = lazy(() => import('@/pages/marketing/Pricing'));
const About = lazy(() => import('@/pages/marketing/About'));
const Faq = lazy(() => import('@/pages/marketing/Faq'));
const Terms = lazy(() => import('@/pages/marketing/Legal').then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => import('@/pages/marketing/Legal').then((m) => ({ default: m.Privacy })));
const Refunds = lazy(() => import('@/pages/marketing/Legal').then((m) => ({ default: m.Refunds })));
const Contact = lazy(() => import('@/pages/marketing/Legal').then((m) => ({ default: m.Contact })));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Journal = lazy(() => import('@/pages/Journal'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const RiskManagement = lazy(() => import('@/pages/RiskManagement'));
const Strategies = lazy(() => import('@/pages/Strategies'));
const Psychology = lazy(() => import('@/pages/Psychology'));
const HallOfFame = lazy(() => import('@/pages/HallOfFame'));
const HallOfShame = lazy(() => import('@/pages/HallOfShame'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));
const Membership = lazy(() => import('@/pages/Membership'));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminSubscriptions = lazy(() => import('@/pages/admin/AdminSubscriptions'));
const AdminPlans = lazy(() => import('@/pages/admin/AdminPlans'));
const AdminInstruments = lazy(() => import('@/pages/admin/AdminInstruments'));
const AdminFeedback = lazy(() => import('@/pages/admin/AdminFeedback'));
const AdminContent = lazy(() => import('@/pages/admin/AdminContent'));
const AdminAudit = lazy(() => import('@/pages/admin/AdminAudit'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const suspend = (node: ReactNode): ReactNode => (
  <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><LoadingState /></div>}>
    {node}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { path: ROUTES.home, element: suspend(<Home />) },
      { path: ROUTES.features, element: suspend(<Features />) },
      { path: ROUTES.pricing, element: suspend(<Pricing />) },
      { path: ROUTES.about, element: suspend(<About />) },
      { path: ROUTES.faq, element: suspend(<Faq />) },
      { path: ROUTES.terms, element: suspend(<Terms />) },
      { path: ROUTES.privacy, element: suspend(<Privacy />) },
      { path: ROUTES.refunds, element: suspend(<Refunds />) },
      { path: ROUTES.contact, element: suspend(<Contact />) },
    ],
  },
  { path: ROUTES.login, element: <GuestRoute>{suspend(<Login />)}</GuestRoute> },
  { path: ROUTES.register, element: <GuestRoute>{suspend(<Register />)}</GuestRoute> },
  { path: ROUTES.forgotPassword, element: <GuestRoute>{suspend(<ForgotPassword />)}</GuestRoute> },
  // NOT guest-gated: the recovery link signs the user in, so a guest guard here
  // would redirect them away before they can set a new password.
  { path: ROUTES.resetPassword, element: suspend(<ResetPassword />) },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: ROUTES.app, element: suspend(<Dashboard />) },
      { path: ROUTES.journal, element: suspend(<Journal />) },
      { path: ROUTES.calendar, element: suspend(<Calendar />) },
      { path: ROUTES.analytics, element: suspend(<Analytics />) },
      { path: ROUTES.risk, element: suspend(<RiskManagement />) },
      { path: ROUTES.strategies, element: suspend(<Strategies />) },
      { path: ROUTES.psychology, element: suspend(<Psychology />) },
      { path: ROUTES.fame, element: suspend(<HallOfFame />) },
      { path: ROUTES.shame, element: suspend(<HallOfShame />) },
      { path: ROUTES.reports, element: suspend(<Reports />) },
      { path: ROUTES.settings, element: suspend(<Settings />) },
      { path: ROUTES.membership, element: suspend(<Membership />) },
    ],
  },
  {
    element: (
      <AdminRoute>
        <AdminShell />
      </AdminRoute>
    ),
    children: [
      { path: ROUTES.admin, element: suspend(<AdminOverview />) },
      { path: ROUTES.adminUsers, element: suspend(<AdminUsers />) },
      { path: ROUTES.adminSubscriptions, element: suspend(<AdminSubscriptions />) },
      { path: ROUTES.adminPlans, element: suspend(<AdminPlans />) },
      { path: ROUTES.adminInstruments, element: suspend(<AdminInstruments />) },
      { path: ROUTES.adminFeedback, element: suspend(<AdminFeedback />) },
      { path: ROUTES.adminContent, element: suspend(<AdminContent />) },
      { path: ROUTES.adminAudit, element: suspend(<AdminAudit />) },
    ],
  },
  { path: '*', element: suspend(<NotFound />) },
]);
