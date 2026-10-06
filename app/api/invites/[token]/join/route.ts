import { NextResponse, type NextRequest } from "next/server";
import { handleJoinInvite } from "../../../../../lib/rooms/http";
import { getRoomRepository } from "../../../../../lib/rooms/repository";
import { getSessionRepository } from "../../../../../lib/session/repository";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/invites/[token]/join">,
) {
  try {
    const { token } = await ctx.params;
    return await handleJoinInvite(
      request,
      token,
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
