import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a single bad component shows a recovery screen
 * instead of a blank white page — which is what happened before, with no way
 * for the user to tell the difference from an outage.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Wire this to Sentry (or equivalent) before launch: without it you only
    // learn about production crashes when a user bothers to report one.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4">
        <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold text-text">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            This page hit an unexpected error. Your trades are safe — nothing was lost.
          </p>

          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-surface-2 p-3 text-left text-xs text-loss">
              {error.message}
            </pre>
          )}

          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={this.reset}>
              <RefreshCcw className="h-4 w-4" /> Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.assign('/app')}>
              Go to dashboard
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted">
            If this keeps happening, let us know at support@tradersworkbook.app.
          </p>
        </div>
      </div>
    );
  }
}
