import {
  Award,
  BarChart3,
  BookOpen,
  Brain,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { ROUTES } from './routes';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const APP_NAV: NavItem[] = [
  { to: ROUTES.app, label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: ROUTES.journal, label: 'Trade Journal', icon: BookOpen },
  { to: ROUTES.analytics, label: 'Analytics', icon: BarChart3 },
  { to: ROUTES.risk, label: 'Risk Management', icon: ShieldAlert },
  { to: ROUTES.strategies, label: 'Strategies', icon: Target },
  { to: ROUTES.psychology, label: 'Psychology', icon: Brain },
  { to: ROUTES.fame, label: 'Hall of Fame', icon: Award },
  { to: ROUTES.shame, label: 'Hall of Shame', icon: TriangleAlert },
  { to: ROUTES.reports, label: 'Reports', icon: FileText },
  { to: ROUTES.settings, label: 'Settings', icon: SlidersHorizontal },
];

/** Primary items surfaced in the mobile bottom bar. */
export const MOBILE_NAV: NavItem[] = [
  { to: ROUTES.app, label: 'Home', icon: LayoutDashboard, end: true },
  { to: ROUTES.journal, label: 'Journal', icon: BookOpen },
  { to: ROUTES.analytics, label: 'Analytics', icon: BarChart3 },
  { to: ROUTES.risk, label: 'Risk', icon: ShieldAlert },
];
