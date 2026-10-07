import { NextResponse, type NextRequest } from "next/server";
import { handleCreateBulkEvents } from "../../../../../../lib/events/http";
import { getEventRepository } from "../../../../../../lib/events/repository";
import { getSessionRepository } from "../../../../../../lib/session/repository";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/rooms/[roomId]/events/bulk">,
) {
  try {
    const { roomId } = await context.params;
    return await handleCreateBulkEvents(
      request,
      roomId,
      getSessionRepository(),
      getEventRepository(),
    );
  } catch {
    return NextResponse.json(
      { error: "Event service unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
