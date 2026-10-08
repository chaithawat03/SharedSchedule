export function RouteLoading({ title }: { title: string }) {
  return (
    <main className="min-h-dvh bg-[#f6f8f5] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-[#18332f] sm:px-8">
      <div className="mx-auto max-w-3xl" role="status" aria-live="polite">
        <h1 className="mt-8 text-3xl font-semibold">{title}</h1>
        <p className="mt-5 text-sm text-[#56716a]">Loading…</p>
      </div>
    </main>
  );
}
