import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    console.error('AqlBand Reaksiya crashed:', error, info);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-ink-900 px-8 text-center">
        <div className="h-12 w-12 rounded-full bg-signal-early/20" />
        <p className="font-display text-base font-semibold text-mist-100">Nimadir xato ketdi</p>
        <p className="max-w-xs text-sm text-mist-500">
          Ilovani qayta yuklab ko&apos;ring. Muammo davom etsa, sozlamalardan statistikani tozalab ko&apos;ring.
        </p>
        <button
          onClick={this.handleReload}
          className="mt-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-mist-100"
        >
          Qayta yuklash
        </button>
      </div>
    );
  }
}
