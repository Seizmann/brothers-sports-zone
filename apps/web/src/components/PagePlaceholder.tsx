/** Interim placeholder for pages built in later phases. */
export function PagePlaceholder({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <main className="flex min-h-screen items-end p-6 sm:p-10 lg:p-16">
      <div>
        <p className="eyebrow mb-6 text-white/60">{eyebrow}</p>
        <h1 className="display-xl">{title}</h1>
      </div>
    </main>
  );
}
