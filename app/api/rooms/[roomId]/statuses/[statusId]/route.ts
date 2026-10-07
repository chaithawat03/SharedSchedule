import { NextResponse, type NextRequest } from "next/server";
import {
  handleDeleteStatus,
  handlePatchStatus,
} from "../../../../../../lib/master-data/http";
import { getMasterRepository } from "../../../../../../lib/master-data/repository";
import { getSessionRepository } from "../../../../../../lib/session/repository";

export const runtime = "nodejs";
const unavailable = () =>
  NextResponse.json(
    { error: "Master service unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/rooms/[roomId]/statuses/[statusId]">,
) {
  try {
    const { roomId, statusId } = await ctx.params;
    return await handlePatchStatus(
      request,
      roomId,
      statusId,
      getSessionRepository(),
      getMasterRepository(),
    );
  } catch {
    return unavailable();
  }
}
export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/rooms/[roomId]/statuses/[statusId]">,
) {
  try {
    const { roomId, statusId } = await ctx.params;
    return await handleDeleteStatus(
      request,
      roomId,
      statusId,
      getSessionRepository(),
      getMasterRepository(),
    );
  } catch {
    return unavailable();
  }
}
