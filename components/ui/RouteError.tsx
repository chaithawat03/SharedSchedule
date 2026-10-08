"use client";

import Link from "next/link";

export function RouteError({
  title,
  reset,
  backHref = "/rooms",
  backLabel = "My Rooms",
}: {
  title: string;
  reset: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="min-h-dvh bg-[#f6f8f5] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-[#18332f] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mt-8 text-3xl font-semibold">{title}</h1>
        <p role="alert" className="mt-3 text-sm text-[#8b3d2d]">
          Please try again.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-xl border border-[#bfd4c6] bg-white px-4 font-semibold text-[#205545] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287466]"
          >
            Retry
          </button>
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center font-semibold text-[#397c61] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287466]"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
