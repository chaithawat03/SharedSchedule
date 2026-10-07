import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "../session/cookie";
import {
  resolveSession,
  type SessionRepository,
} from "../../services/session.service";
import {
  createEvent,
  deleteEvent,
  EventError,
  updateEvent,
  type EventRepository,
} from "../../services/event.service";

const headers = { "Cache-Control": "no-store" };
function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers });
}
function failure(error: unknown) {
  if (error instanceof EventError) {
    const status =
      error.code === "INVALID_INPUT"
        ? 400
        : error.code === "FORBIDDEN"
          ? 403
          : 404;
    return json({ error: error.message, code: error.code }, status);
  }
  return json({ error: "Event service unavailable" }, 503);
}
async function userId(request: NextRequest, sessions: SessionRepository) {
  const user = await resolveSession(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    sessions,
  );
  return user?.id ?? null;
}
async function body(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new EventError("INVALID_INPUT", "Enter valid JSON");
  }
}

export async function handleCreateEvent(
  request: NextRequest,
  roomId: string,
  sessions: SessionRepository,
  events: EventRepository,
) {
  try {
    const user = await userId(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    return json(
      { event: await createEvent(user, roomId, await body(request), events) },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleUpdateEvent(
  request: NextRequest,
  eventId: string,
  sessions: SessionRepository,
  events: EventRepository,
) {
  try {
    const user = await userId(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    return json({
      event: await updateEvent(user, eventId, await body(request), events),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function handleDeleteEvent(
  request: NextRequest,
  eventId: string,
  sessions: SessionRepository,
  events: EventRepository,
) {
  try {
    const user = await userId(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    return json({ event: await deleteEvent(user, eventId, events) });
  } catch (error) {
    return failure(error);
  }
}
