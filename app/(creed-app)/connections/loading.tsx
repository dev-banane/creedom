// Transition skeleton for /connections. Mirrors the real layout: page
// heading + subtitle, the MCP connection card, then the health dashboard
// (range control, KPI tiles, chart). Matches the screen's max-w-6xl
// container and paddings.
function Block({ className }: { className?: string }) {
  return (
    <div className={`rounded-[8px] bg-[var(--creed-surface-raised)] ${className ?? ""}`} />
  );
}

export default function ConnectionsLoading() {
  return (
    <div className="h-full overflow-hidden bg-[var(--creed-surface)]" aria-hidden="true">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-12 md:py-10">
        <div className="animate-pulse">
          {/* Heading */}
          <Block className="h-7 w-44" />
          <Block className="mt-3 h-4 w-80 max-w-full" />

          {/* MCP connection card */}
          <div className="mt-8 max-w-3xl">
            <Block className="h-4 w-40" />
            <div className="mt-5 rounded-[16px] border border-[var(--creed-border)] bg-[var(--creed-surface)] p-5">
              <div className="flex items-center justify-between gap-4">
                <Block className="h-4 w-48" />
                <Block className="h-8 w-24 rounded-[10px]" />
              </div>
              <Block className="mt-4 h-9 w-full rounded-[10px]" />
            </div>
          </div>

          {/* Health dashboard: range control + KPI tiles + chart */}
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <Block className="h-4 w-32" />
              <Block className="h-8 w-32 rounded-[10px]" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Block key={i} className="h-24 w-full rounded-[16px]" />
              ))}
            </div>
            <Block className="mt-4 h-64 w-full rounded-[16px]" />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Block className="h-48 w-full rounded-[16px]" />
              <Block className="h-48 w-full rounded-[16px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
