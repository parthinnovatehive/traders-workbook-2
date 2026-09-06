import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Brain,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { EquityPoint } from '@/types';
import { ROUTES } from '@/constants/routes';
import { Badge, Button, MetricCard } from '@/components/ui';
import { EquityCurveChart } from '@/components/charts';

const SAMPLE: EquityPoint[] = [10000, 10420, 10180, 10890, 11540, 11320, 12180, 12640, 12410, 13280, 13910, 14620].map(
  (equity, index) => ({ index, equity, drawdown: 0 }),
);

const PILLARS = [
  { icon: BarChart3, title: 'Performance Analytics', text: 'Equity curves, expectancy, drawdown, R-multiples — computed from real trades.' },
  { icon: ShieldCheck, title: 'Risk Management', text: 'Position sizing, daily loss limits and drawdown monitoring that keep you in the game.' },
  { icon: Brain, title: 'Trading Psychology', text: 'See how FOMO, revenge and discipline actually move your bottom line.' },
  { icon: Target, title: 'Strategy Edge', text: 'Compare every setup and double down on what genuinely works.' },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-10 sm:px-6 lg:pt-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Badge tone="primary" className="mb-5">
              <Sparkles className="h-3 w-3" /> Trading performance OS
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-text sm:text-5xl">
              Turn every trade into data.
              <br />
              Turn your data into <span className="text-primary">discipline.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted">
              Trader&apos;s Workbook is the complete journal, analytics and performance management system for
              serious traders. Record, analyze, identify mistakes, measure, improve — repeat.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={ROUTES.register}>
                <Button size="lg">
                  Get started free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to={ROUTES.login}>
                <Button size="lg" variant="outline">
                  Try the live demo
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">No credit card required · Free plan forever</p>
          </div>

          {/* Product preview */}
          <div className="rounded-card border border-border bg-surface p-4 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-profit" />
              <span className="text-sm font-semibold text-text">Equity Curve</span>
              <Badge tone="profit" className="ml-auto">
                +46.2%
              </Badge>
            </div>
            <EquityCurveChart data={SAMPLE} height={200} valueFormatter={(n) => `$${(n / 1000).toFixed(0)}k`} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MetricCard label="Win Rate" value="58%" />
              <MetricCard label="Avg R" value="+0.74R" tone="profit" />
              <MetricCard label="Expectancy" value="$312" tone="profit" />
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-card border border-border bg-surface p-5">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <p.icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-semibold text-text">{p.title}</h3>
              <p className="mt-1.5 text-xs text-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Philosophy */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">The loop</p>
          <h2 className="mt-3 text-2xl font-semibold text-text">
            Record → Analyze → Identify mistakes → Measure → Improve → Repeat
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted">
            The primary question isn&apos;t &ldquo;how many trades did you take?&rdquo; — it&apos;s &ldquo;how consistently did you
            execute your edge?&rdquo; Trader&apos;s Workbook is built to make you a better, more disciplined trader.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-semibold text-text">Ready to trade with an edge you can measure?</h2>
        <div className="mt-6 flex justify-center gap-3">
          <Link to={ROUTES.register}>
            <Button size="lg">Create your workbook</Button>
          </Link>
          <Link to={ROUTES.pricing}>
            <Button size="lg" variant="outline">
              See pricing
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
