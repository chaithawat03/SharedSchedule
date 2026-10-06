import { NextResponse, type NextRequest } from "next/server";
import {
  getCalendarMonth,
  CalendarError,
  type CalendarRepository,
} from "../../services/calendar.service";
import {
  resolveSession,
  type SessionRepository,
} from "../../services/session.service";
import { SESSION_COOKIE_NAME } from "../session/cookie";

const noStore = { "Cache-Control": "no-store" };

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: noStore });
}

export async function handleGetCalendar(
  request: NextRequest,
  roomId: string,
  sessions: SessionRepository,
  calendar: CalendarRepository,
) {
  try {
    const user = await resolveSession(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
      sessions,
    );
    if (!user) return json({ error: "Unauthorized" }, 401);
    const yearText = request.nextUrl.searchParams.get("year");
    const monthText = request.nextUrl.searchParams.get("month");
    if (
      !yearText ||
      !/^\d{4}$/.test(yearText) ||
      !monthText ||
      !/^\d{1,2}$/.test(monthText)
    ) {
      return json(
        { error: "Enter a valid year and month", code: "INVALID_INPUT" },
        400,
      );
    }
    const model = await getCalendarMonth(
      user,
      roomId,
      Number(yearText),
      Number(monthText),
      calendar,
    );
    return json(model);
  } catch (error) {
    if (error instanceof CalendarError) {
      return json(
        { error: error.message, code: error.code },
        error.code === "INVALID_INPUT" ? 400 : 404,
      );
    }
    return json({ error: "Calendar service unavailable" }, 503);
  }
}
