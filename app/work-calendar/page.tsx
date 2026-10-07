import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkCalendarEditor } from "../../components/work-schedule/WorkCalendarEditor";
import { bangkokToday } from "../../lib/calendar/date";
import { SESSION_COOKIE_NAME } from "../../lib/session/cookie";
import { getSessionRepository } from "../../lib/session/repository";
import { resolveSession } from "../../services/session.service";

export default async function WorkCalendarPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const user = await resolveSession(token, getSessionRepository());
  if (!user) redirect("/");
  const [year, month] = bangkokToday().split("-").map(Number);
  return (
    <main className="min-h-dvh bg-[#f6f8f5] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-2xl px-5 pt-4 sm:px-7">
        <Link
          href="/rooms"
          className="flex min-h-11 items-center text-sm font-semibold text-[#397c61]"
        >
          ← My Rooms
        </Link>
      </div>
      <WorkCalendarEditor initialYear={year} initialMonth={month} standalone />
    </main>
  );
}
