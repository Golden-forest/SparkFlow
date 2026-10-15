import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

/** Catches render/lazy-load failures; async actions still handle their own errors. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Never report raw account/session data to the browser or external services.
    console.error('The application could not render this page.');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0D1117] p-6">
        <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center" role="alert">
          <h1 className="mb-4 text-2xl font-semibold">Something went wrong</h1>
          <p className="mb-6 text-slate-300">Reload the page to try again, or return to home.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
            <a className="btn btn-secondary" href="/">Back to home</a>
          </div>
        </section>
      </main>
    );
  }
}
