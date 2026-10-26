export default function Loading() {
  return <main className="container py-16" aria-busy="true" aria-live="polite">
    <div className="h-3 w-28 animate-pulse rounded bg-emerald-100" />
    <div className="mt-5 h-10 max-w-lg animate-pulse rounded bg-slate-200" />
    <div className="mt-3 h-5 max-w-md animate-pulse rounded bg-slate-100" />
    <div className="mt-10 grid gap-4 md:grid-cols-2"><div className="h-44 animate-pulse rounded-2xl bg-white"/><div className="h-44 animate-pulse rounded-2xl bg-white"/></div>
    <span className="sr-only">Loading Doctor Queue…</span>
  </main>;
}