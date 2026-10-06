import { NextResponse, type NextRequest } from "next/server";
import { handleGetRoom } from "../../../../lib/rooms/http";
import { getRoomRepository } from "../../../../lib/rooms/repository";
import { getSessionRepository } from "../../../../lib/session/repository";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/rooms/[roomId]">,
) {
  try {
    const { roomId } = await ctx.params;
    return await handleGetRoom(
      request,
      roomId,
      getSessionRepository(),
      getRoomRepository(),
    );
  } catch {
    return NextResponse.json(
      { error: "Room service unavailable" },
      { status: 503 },
    );
  }
}
