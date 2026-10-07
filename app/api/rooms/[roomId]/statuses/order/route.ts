import { NextResponse, type NextRequest } from "next/server";
import { handlePutStatusOrder } from "../../../../../../lib/master-data/http";
import { getMasterRepository } from "../../../../../../lib/master-data/repository";
import { getSessionRepository } from "../../../../../../lib/session/repository";

export const runtime = "nodejs";
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/rooms/[roomId]/statuses/order">,
) {
  try {
    return await handlePutStatusOrder(
      request,
      (await ctx.params).roomId,
      getSessionRepository(),
      getMasterRepository(),
    );
  } catch {
    return NextResponse.json(
      { error: "Master service unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
