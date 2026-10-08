import { NextResponse, type NextRequest } from "next/server";
import type { SessionRepository } from "../../services/session.service";
import { resolveSession } from "../../services/session.service";
import {
  listNotifications,
  markNotificationRead,
  NotificationError,
  type NotificationRepository,
} from "../../services/notification.service";
import { SESSION_COOKIE_NAME } from "../session/cookie";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function userId(request: NextRequest, sessions: SessionRepository) {
  const user = await resolveSession(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    sessions,
  );
  return user?.id ?? null;
}

function failure(error: unknown) {
  if (error instanceof NotificationError)
    return json(
      { error: error.message, code: error.code },
      error.code === "INVALID_INPUT" ? 400 : 404,
    );
  return json({ error: "Notification service unavailable" }, 503);
}

export async function handleListNotifications(
  request: NextRequest,
  sessions: SessionRepository,
  repo: NotificationRepository,
): Promise<Response> {
  try {
    const user = await userId(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const params = request.nextUrl.searchParams;
    if (params.getAll("limit").length > 1 || params.getAll("cursor").length > 1)
      throw new NotificationError(
        "INVALID_INPUT",
        "Invalid pagination parameters",
      );
    return json(
      await listNotifications(
        user,
        params.get("limit"),
        params.get("cursor"),
        repo,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleMarkNotificationRead(
  request: NextRequest,
  id: string,
  sessions: SessionRepository,
  repo: NotificationRepository,
): Promise<Response> {
  try {
    const user = await userId(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    return json({ notification: await markNotificationRead(user, id, repo) });
  } catch (error) {
    return failure(error);
  }
}
