import { NextResponse, type NextRequest } from "next/server";
import { handleGetCalendar } from "../../../../../lib/calendar/http";
import { getCalendarRepository } from "../../../../../lib/calendar/repository";
import { getSessionRepository } from "../../../../../lib/session/repository";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/rooms/[roomId]/calendar">,
) {
  try {
    const { roomId } = await ctx.params;
    return await handleGetCalendar(
      request,
      roomId,
      getSessionRepository(),
      getCalendarRepository(),
    );
  } catch {
    return NextResponse.json(
      { error: "Calendar service unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
