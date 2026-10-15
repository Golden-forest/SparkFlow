import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatusPageProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function StatusPage({ title, children, action }: StatusPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0D1117] px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
        <h1 className="mb-4 text-2xl font-semibold text-slate-100">{title}</h1>
        <div className="mb-6 text-slate-300">{children}</div>
        {action ?? <Link className="btn btn-primary inline-flex" to="/">Back to home</Link>}
      </section>
    </main>
  );
}

export function NotFoundPage() {
  return <StatusPage title="Page not found">The requested page does not exist.</StatusPage>;
}

export function LoadingPage() {
  return <StatusPage title="Loading" action={<span role="status">Please wait…</span>} />;
}
