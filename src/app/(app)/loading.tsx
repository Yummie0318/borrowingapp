export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      <div className="h-7 w-48 rounded bg-line md:h-9 md:w-64" />
      <div className="mt-2 h-4 w-64 max-w-full rounded bg-line/70" />

      <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line md:mt-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 bg-surface p-3 md:p-4">
            <div className="h-3 w-16 rounded bg-line/70" />
            <div className="h-6 w-12 rounded bg-line md:h-8" />
          </div>
        ))}
      </div>

      <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface md:mt-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3 md:px-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/5 rounded bg-line" />
              <div className="h-3 w-3/5 rounded bg-line/70" />
            </div>
            <div className="h-8 w-20 rounded-md bg-line/70" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}