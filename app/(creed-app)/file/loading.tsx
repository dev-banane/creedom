// Transition skeleton for /file. Mirrors the editor's real layout: the
// sticky header (title "<name> / Creed" + sync line on the left, quality
// ring + push/pull pill on the right) and a stack of section cards in the
// max-w-[920px] canvas. The persistent shell sidebar stays mounted; this
// only fills the editor pane.
function Block({ className }: { className?: string }) {
  return (
    <div className={`rounded-[8px] bg-[var(--creed-surface-raised)] ${className ?? ""}`} />
  );
}

export default function FileLoading() {
  return (
    <div className="h-full overflow-hidden bg-[var(--creed-surface)]" aria-hidden="true">
      <div className="mx-auto max-w-[920px] px-4 py-6 md:px-12 md:py-10 xl:px-16">
        <div className="animate-pulse">
          {/* Header row: title + actions */}
          <div className="mb-8 flex items-start justify-between md:mb-12">
            <div>
              <Block className="h-6 w-56" />
              <Block className="mt-3 h-3.5 w-28" />
            </div>
            <div className="flex items-center gap-2">
              <Block className="h-7 w-7 rounded-full" />
              <Block className="h-8 w-24 rounded-[13px]" />
            </div>
          </div>

          {/* Section cards */}
          <div className="space-y-8">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <Block className="h-2.5 w-2.5 rounded-[3px]" />
                  <Block className="h-4 w-32" />
                </div>
                <div className="mt-4 space-y-2.5">
                  <Block className="h-3.5 w-full" />
                  <Block className="h-3.5 w-[92%]" />
                  <Block className="h-3.5 w-[78%]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
