export default function Home() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f6f8f5] text-[#18332f]">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8 lg:px-12">
        <header
          className="flex min-h-11 items-center justify-between gap-4"
          aria-label="Site header"
        >
          <a
            className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287466]"
            href="#top"
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
          </a>
          <span className="rounded-full border border-[#d3e3db] bg-white/80 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#477263] sm:text-xs">
            Foundation · 01
          </span>
        </header>

        <section
          id="top"
          className="grid flex-1 items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16"
          aria-labelledby="hero-title"
        >
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#e6f2ea] px-4 py-2 text-xs font-semibold tracking-[0.08em] text-[#276451] uppercase">
              <span
                className="size-2 rounded-full bg-[#4aa974]"
                aria-hidden="true"
              />
              A shared rhythm for real life
            </p>
            <h1
              id="hero-title"
              className="max-w-xl text-[clamp(3.2rem,9vw,6.4rem)] leading-[0.98] font-semibold tracking-[-0.07em] text-[#173b34]"
            >
              Make time <span className="text-[#5b9877]">together.</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-[#56716a] sm:text-lg sm:leading-8">
              SharedSchedule brings changing shifts, days off, and plans into
              one calm place. The foundation is ready for the shared calendar to
              come.
            </p>
            <div
              className="mt-9 flex flex-wrap gap-3"
              aria-label="Foundation capabilities"
            >
              <span className="rounded-full border border-[#d8e4dd] bg-white px-4 py-2.5 text-sm font-medium text-[#335c50]">
                Built for mobile
              </span>
              <span className="rounded-full border border-[#d8e4dd] bg-white px-4 py-2.5 text-sm font-medium text-[#335c50]">
                Room-ready data
              </span>
              <span className="rounded-full border border-[#d8e4dd] bg-white px-4 py-2.5 text-sm font-medium text-[#335c50]">
                Flexible schedules
              </span>
            </div>
          </div>

          <div
            className="relative mx-auto w-full max-w-[470px]"
            aria-label="Illustrative schedule preview"
          >
            <div
              className="absolute -top-7 -right-5 size-40 rounded-full bg-[#dcefe1] blur-3xl"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-8 -left-6 size-40 rounded-full bg-[#f6e8d4] blur-3xl"
              aria-hidden="true"
            />
            <div className="relative rounded-[2rem] border border-[#dce8e0] bg-white p-5 shadow-[0_30px_80px_-35px_rgba(31,75,55,0.28)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7c9788]">
                    A little more in sync
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-[#1e4639]">
                    October plans
                  </h2>
                </div>
                <span className="rounded-xl bg-[#f1f7f1] px-3 py-2 text-xs font-semibold text-[#4a8061]">
                  Preview
                </span>
              </div>
              <div className="mt-7 grid grid-cols-7 gap-1.5 text-center text-[0.65rem] font-semibold text-[#91a69a] sm:gap-2">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>
              <div
                className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2"
                aria-hidden="true"
              >
                {Array.from({ length: 14 }, (_, index) => (
                  <div
                    key={index}
                    className={`flex aspect-[0.78] flex-col items-center rounded-xl border p-1.5 text-xs font-medium sm:rounded-2xl sm:p-2 ${index === 10 ? "border-[#5b9877] bg-[#eaf5ed] text-[#26634e]" : "border-[#edf1ed] bg-[#fbfcfa] text-[#577568]"}`}
                  >
                    <span>{index + 5}</span>
                    {index === 3 && (
                      <span className="mt-auto size-1.5 rounded-full bg-[#dfad76]" />
                    )}
                    {index === 7 && (
                      <span className="mt-auto size-1.5 rounded-full bg-[#78b090]" />
                    )}
                    {index === 10 && (
                      <span className="mt-auto size-1.5 rounded-full bg-[#5b9877]" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#f4f8f3] p-3.5">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e4efe3] text-lg"
                  aria-hidden="true"
                >
                  ✦
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#315647]">
                    Everyone’s day, at a glance
                  </p>
                  <p className="mt-0.5 text-xs text-[#799184]">
                    A preview of what’s ahead
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[#dce7de] pt-5 text-xs text-[#749083] sm:flex-row sm:items-center sm:justify-between">
          <span>SharedSchedule · Milestone 1</span>
          <span>Designed for the moments you share.</span>
        </footer>
      </div>
    </main>
  );
}
