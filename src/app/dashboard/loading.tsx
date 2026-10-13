export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading admin workspace"
      className="mx-auto max-w-7xl animate-pulse"
    >
      <span className="sr-only">Loading workspace…</span>
      <div aria-hidden="true" className="h-4 w-28 rounded bg-slate-200" />
      <div className="mt-3 h-10 w-72 rounded bg-slate-200" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-white" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-2xl bg-white" />
    </div>
  );
}
