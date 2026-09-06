import { Link } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  FileText,
  ShieldCheck,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui';

const FEATURES = [
  { icon: BookOpen, title: 'Powerful Trade Journal', text: 'Capture every detail — prices, size, stops, targets, setups, psychology and mistakes — with calculated values that are always read-only and accurate.' },
  { icon: Calculator, title: 'Trusted Calculation Engine', text: 'Gross/net P&L, risk, R-multiples, expectancy, drawdown and ROI from a single, unit-tested source of truth. Missing data shows N/A — never invented numbers.' },
  { icon: BarChart3, title: 'Deep Analytics', text: 'Equity curve, daily & monthly P&L, R-distribution, time-of-day and strategy performance with consistent date filtering.' },
  { icon: ShieldCheck, title: 'Risk Management', text: 'Configure risk-per-trade, daily loss limits and drawdown ceilings. Get clear, professional warnings before you break your own rules.' },
  { icon: Target, title: 'Strategy Comparison', text: 'Measure the expectancy and win rate of every setup so you can scale what works and cut what doesn’t.' },
  { icon: Brain, title: 'Psychology Tracking', text: 'Quantify how emotions and behaviour affect results — and exactly how much your edge changes after a loss.' },
  { icon: Award, title: 'Hall of Fame', text: 'Celebrate your best executions, strategies and trading days with a rewarding, badge-driven view.' },
  { icon: TriangleAlert, title: 'Hall of Shame', text: 'Turn your worst trades into lessons with constructive, no-judgement breakdowns of what better looked like.' },
  { icon: FileText, title: 'Reports & Export', text: 'Daily to yearly reports with CSV/Excel export and print-to-PDF for your records and reviews.' },
];

export default function Features() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">Everything a serious trader needs</h1>
        <p className="mt-4 text-muted">
          Not a generic dashboard — a professional trading performance operating system built around accuracy,
          discipline and real improvement.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-card border border-border bg-surface p-6">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-text">{f.title}</h3>
            <p className="mt-2 text-sm text-muted">{f.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Link to={ROUTES.register}>
          <Button size="lg">Start free</Button>
        </Link>
      </div>
    </div>
  );
}
