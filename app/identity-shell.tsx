import Link from "next/link";
import type { PublicSessionUser } from "../services/session.service";
import { PhoneIdentityForm } from "../components/session/PhoneIdentityForm";
import { LogoutButton } from "../components/session/LogoutButton";

export function IdentityShell({ user }: { user: PublicSessionUser | null }) {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f6f8f5] text-[#18332f]">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8 lg:px-12">
        <header
          className="flex min-h-11 items-center justify-between gap-4"
          aria-label="Site header"
        >
          <Link
            className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287466]"
            href="/"
            aria-label="SharedSchedule home"
          >
            <span
              className="grid size-10 place-items-center rounded-2xl bg-[#183e37] text-xl font-semibold text-white shadow-sm"
              aria-hidden="true"
            >
              S
            </span>
            <span className="text-[1.05rem] font-semibold tracking-[-0.035em]">
              SharedSchedule
            </span>
          </Link>
          <span className="rounded-full border border-[#d3e3db] bg-white/80 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#477263] sm:text-xs">
            Shared time, simply
          </span>
        </header>

        <section
          className="grid flex-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_0.9fr] lg:gap-20"
          aria-labelledby="hero-title"
        >
          <div className="max-w-xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#e6f2ea] px-4 py-2 text-xs font-semibold tracking-[0.08em] text-[#276451] uppercase">
              <span
                className="size-2 rounded-full bg-[#4aa974]"
                aria-hidden="true"
              />
              Plans are better together
            </p>
            <h1
              id="hero-title"
              className="text-[clamp(3rem,9vw,6rem)] leading-[1.01] font-semibold tracking-[-0.065em] text-[#173b34]"
            >
              Make time <span className="text-[#5b9877]">together.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-[#56716a] sm:text-lg sm:leading-8">
              A calm place for changing shifts, days off, and the moments you
              want to share.
            </p>
            <div
              className="mt-8 flex flex-wrap gap-2.5"
              aria-label="SharedSchedule highlights"
            >
              <span className="rounded-full border border-[#d8e4dd] bg-white px-4 py-2.5 text-sm font-medium text-[#335c50]">
                Made for mobile
              </span>
              <span className="rounded-full border border-[#d8e4dd] bg-white px-4 py-2.5 text-sm font-medium text-[#335c50]">
                Flexible schedules
              </span>
            </div>
          </div>

          <div className="relative w-full max-w-[460px] justify-self-center lg:justify-self-end">
            <div
              className="absolute -top-10 -right-5 size-40 rounded-full bg-[#dcefe1] blur-3xl"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-10 -left-5 size-40 rounded-full bg-[#f6e8d4] blur-3xl"
              aria-hidden="true"
            />
            <div className="relative min-h-[420px] rounded-[2rem] border border-[#dce8e0] bg-white p-6 shadow-[0_30px_80px_-35px_rgba(31,75,55,0.28)] sm:p-8">
              {user ? (
                <div className="flex min-h-[360px] flex-col">
                  <span
                    className="grid size-14 place-items-center rounded-2xl bg-[#e6f2ea] text-xl font-semibold text-[#276451]"
                    aria-hidden="true"
                  >
                    {user.displayName.charAt(0).toUpperCase()}
                  </span>
                  <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#729080]">
                    You are connected
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#173b34]">{`Signed in as ${user.displayName}`}</h2>
                  <p className="mt-3 text-sm leading-6 text-[#718b7c]">
                    Open your rooms to see the shared monthly calendar.
                  </p>
                  {user.phoneDisplay && (
                    <p className="mt-5 text-sm font-medium text-[#456c5c]">
                      {user.phoneDisplay}
                    </p>
                  )}
                  <div className="mt-auto pt-8">
                    <LogoutButton />
                  </div>
                </div>
              ) : (
                <PhoneIdentityForm />
              )}
            </div>
          </div>
        </section>

        <footer className="border-t border-[#dce7de] pt-5 text-xs text-[#749083]">
          SharedSchedule · Your time, together.
        </footer>
      </div>
    </main>
  );
}
