import { NextResponse, type NextRequest } from "next/server";
import {
  handleDeleteEvent,
  handleUpdateEvent,
} from "../../../../lib/events/http";
import { getEventRepository } from "../../../../lib/events/repository";
import { getSessionRepository } from "../../../../lib/session/repository";

export const runtime = "nodejs";
type Context = RouteContext<"/api/events/[eventId]">;
const unavailable = () =>
  NextResponse.json(
    { error: "Event service unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { eventId } = await context.params;
    return await handleUpdateEvent(
      request,
      eventId,
      getSessionRepository(),
      getEventRepository(),
    );
  } catch {
    return unavailable();
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { eventId } = await context.params;
    return await handleDeleteEvent(
      request,
      eventId,
      getSessionRepository(),
      getEventRepository(),
    );
  } catch {
    return unavailable();
  }
}
