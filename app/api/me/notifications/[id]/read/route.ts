import type { NextRequest } from "next/server";
import { handleMarkNotificationRead } from "../../../../../../lib/notifications/http";
import { getNotificationRepository } from "../../../../../../lib/notifications/repository";
import { getSessionRepository } from "../../../../../../lib/session/repository";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleMarkNotificationRead(
    request,
    id,
    getSessionRepository(),
    getNotificationRepository(),
  );
}
