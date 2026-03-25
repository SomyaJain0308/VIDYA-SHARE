import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown render error' };
  }

  componentDidCatch(error, info) {
    console.error('App error boundary caught an error', error, info);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="safe-inline flex min-h-screen items-center justify-center px-4 py-8">
          <div className="lux-panel w-full max-w-md p-6 text-center sm:p-7">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-300/14 text-rose-200">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="font-display mt-4 text-2xl font-semibold text-white">Something went wrong</h2>
            <p className="mt-2 text-sm leading-relaxed text-cyan-50/72">
              The app hit a loading error on this device. Reload once to recover the latest version.
            </p>
            <p className="mt-3 break-words rounded-xl border border-cyan-300/14 bg-white/[0.03] px-3 py-2 text-left text-xs text-cyan-50/66">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="btn-primary mt-5 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
            >
              <RotateCw className="h-4 w-4" />
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
