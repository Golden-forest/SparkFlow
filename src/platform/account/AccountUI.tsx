import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const accountButtonClass = 'inline-flex items-center justify-center gap-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50';
export const accountInputClass = 'w-full rounded-lg border border-slate-600 bg-[#0D1117] px-3 py-2.5 text-base text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 disabled:opacity-60';

export function AccountCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="mx-auto w-full max-w-md rounded-2xl border border-[#30363D] bg-[#111827] p-6 shadow-xl sm:p-8">
    <h1 className="mb-3 text-2xl font-semibold text-slate-100">{title}</h1>
    {description ? <p className="mb-6 text-sm leading-relaxed text-slate-400">{description}</p> : null}
    {children}
  </section>;
}

export function AccountField({ label, hint, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return <div>
    <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-300">{label}</label>
    <input {...input} id={id} className={accountInputClass} aria-describedby={hint ? `${id}-hint` : undefined} />
    {hint ? <p id={`${id}-hint`} className="mt-2 text-xs leading-relaxed text-slate-400">{hint}</p> : null}
  </div>;
}

export function AccountNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p role={error ? 'alert' : 'status'} className={`mb-5 rounded-lg border px-3 py-3 text-sm leading-relaxed ${error ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100'}`}>{children}</p>;
}

export function AccountLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="rounded-sm text-sm font-medium text-cyan-300 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">{children}</Link>;
}
