import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { LoadingState } from '@/components/ui';
import { AppShell } from '@/components/layout/AppShell';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { AdminRoute, ProtectedRoute } from './guards';

// Lazy-loaded routes → each page becomes its own chunk, keeping the initial
// (marketing/auth) load small and deferring heavy chart code until needed.
const Home = lazy(() => import('@/pages/marketing/Home'));
const Features = lazy(() => import('@/pages/marketing/Features'));
const Pricing = lazy(() => import('@/pages/marketing/Pricing'));
const About = lazy(() => import('@/pages/marketing/About'));
const Faq = lazy(() => import('@/pages/marketing/Faq'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Journal = lazy(() => import('@/pages/Journal'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const RiskManagement = lazy(() => import('@/pages/RiskManagement'));
const Strategies = lazy(() => import('@/pages/Strategies'));
const Psychology = lazy(() => import('@/pages/Psychology'));
const HallOfFame = lazy(() => import('@/pages/HallOfFame'));
const HallOfShame = lazy(() => import('@/pages/HallOfShame'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));
const Membership = lazy(() => import('@/pages/Membership'));
const Admin = lazy(() => import('@/pages/Admin'));
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
    ],
  },
  { path: ROUTES.login, element: suspend(<Login />) },
  { path: ROUTES.register, element: suspend(<Register />) },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: ROUTES.app, element: suspend(<Dashboard />) },
      { path: ROUTES.journal, element: suspend(<Journal />) },
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
    path: ROUTES.admin,
    element: (
      <AdminRoute>
        {suspend(<Admin />)}
      </AdminRoute>
    ),
  },
  { path: '*', element: suspend(<NotFound />) },
]);
