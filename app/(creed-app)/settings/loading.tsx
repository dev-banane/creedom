// Transition skeleton for /settings. Mirrors the real layout: the page
// heading then a stack of labelled sections, each a heading line over a
// bordered card. Matches the screen's max-w-3xl container and paddings.
function Block({ className }: { className?: string }) {
  return (
    <div className={`rounded-[8px] bg-[var(--creed-surface-raised)] ${className ?? ""}`} />
  );
}

function SettingsSection({ cardClassName }: { cardClassName: string }) {
  return (
    <section className="mt-10">
      <Block className="h-4 w-36" />
      <div
        className={`mt-4 rounded-[var(--radius-xl)] border border-[var(--creed-border)] bg-[var(--creed-surface)] p-5 ${cardClassName}`}
      />
    </section>
  );
}

export default function SettingsLoading() {
  return (
    <div className="h-full overflow-hidden bg-[var(--creed-surface)]" aria-hidden="true">
      <div className="mx-auto max-w-3xl px-8 py-10 md:px-14">
        <div className="animate-pulse">
          <Block className="h-7 w-40" />
          <SettingsSection cardClassName="h-20" />
          <SettingsSection cardClassName="h-24" />
          <SettingsSection cardClassName="h-44" />
          <SettingsSection cardClassName="h-28" />
        </div>
      </div>
    </div>
  );
}
