import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  stack: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '', stack: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error && error.stack ? error.stack : '',
    };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    console.error('AqlBand Reaksiya crashed:', error, info);
    const componentStack = (info as { componentStack?: string } | undefined)?.componentStack ?? '';
    const w = window as unknown as { __aqlband?: { errors: string[] } };
    w.__aqlband?.errors.push(
      'React ErrorBoundary: ' +
        (error instanceof Error ? error.message : String(error)) +
        '\nComponent stack:' +
        componentStack,
    );
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-ink-900 px-6 text-center">
        <div className="h-12 w-12 rounded-full bg-signal-early/20" />
        <p className="font-display text-base font-semibold text-mist-100">Nimadir xato ketdi</p>
        <p className="max-w-xs text-sm text-mist-500">
          Ilovani qayta yuklab ko&apos;ring. Muammo davom etsa, quyidagi matnni nusxalab yuboring.
        </p>
        <button
          onClick={this.handleReload}
          className="mt-1 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-mist-100"
        >
          Qayta yuklash
        </button>
        <div className="mt-4 w-full max-w-sm rounded-xl border border-ink-600 bg-ink-800 p-3 text-left">
          <p className="break-words font-mono text-[11px] leading-relaxed text-signal-early">{this.state.message}</p>
          {this.state.stack && (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-mist-500">
              {this.state.stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
