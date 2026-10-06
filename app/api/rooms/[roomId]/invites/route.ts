import { NextResponse, type NextRequest } from "next/server";
import { handleCreateInvite } from "../../../../../lib/rooms/http";
import { getRoomRepository } from "../../../../../lib/rooms/repository";
import { getSessionRepository } from "../../../../../lib/session/repository";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/rooms/[roomId]/invites">,
) {
  try {
    const { roomId } = await ctx.params;
    return await handleCreateInvite(
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
