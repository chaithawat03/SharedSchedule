import { NextResponse, type NextRequest } from "next/server";
import { handleInspectInvite } from "../../../../lib/rooms/http";
import { getRoomRepository } from "../../../../lib/rooms/repository";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/invites/[token]">,
) {
  try {
    const { token } = await ctx.params;
    return await handleInspectInvite(request, token, getRoomRepository());
  } catch {
    return NextResponse.json(
      { error: "Room service unavailable" },
      { status: 503 },
    );
  }
}
