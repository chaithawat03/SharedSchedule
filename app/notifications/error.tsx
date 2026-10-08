"use client";

import Link from "next/link";

export default function NotificationsError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-dvh bg-[#f6f8f5] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-[#18332f] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mt-8 text-3xl font-semibold">
          Notifications are unavailable
        </h1>
        <p role="alert" className="mt-3 text-sm text-[#8b3d2d]">
          Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 min-h-11 rounded-xl border border-[#bfd4c6] bg-white px-4 font-semibold text-[#205545]"
        >
          Retry
        </button>
        <Link
          href="/rooms"
          className="ml-3 inline-flex min-h-11 items-center font-semibold text-[#397c61]"
        >
          My Rooms
        </Link>
      </div>
    </main>
  );
}
