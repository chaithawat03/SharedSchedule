import { NextResponse, type NextRequest } from "next/server";
import {
  handleDeleteLocation,
  handlePatchLocation,
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
  ctx: RouteContext<"/api/rooms/[roomId]/locations/[locationId]">,
) {
  try {
    const { roomId, locationId } = await ctx.params;
    return await handlePatchLocation(
      request,
      roomId,
      locationId,
      getSessionRepository(),
      getMasterRepository(),
    );
  } catch {
    return unavailable();
  }
}
export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/rooms/[roomId]/locations/[locationId]">,
) {
  try {
    const { roomId, locationId } = await ctx.params;
    return await handleDeleteLocation(
      request,
      roomId,
      locationId,
      getSessionRepository(),
      getMasterRepository(),
    );
  } catch {
    return unavailable();
  }
}
