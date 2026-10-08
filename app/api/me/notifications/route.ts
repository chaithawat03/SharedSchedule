import type { NextRequest } from "next/server";
import { handleListNotifications } from "../../../../lib/notifications/http";
import { getNotificationRepository } from "../../../../lib/notifications/repository";
import { getSessionRepository } from "../../../../lib/session/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleListNotifications(
    request,
    getSessionRepository(),
    getNotificationRepository(),
  );
}
