import { NextResponse, type NextRequest } from "next/server";
import {
  handleCreateLocation,
  handleGetLocations,
} from "../../../../../lib/master-data/http";
import { getMasterRepository } from "../../../../../lib/master-data/repository";
import { getSessionRepository } from "../../../../../lib/session/repository";

export const runtime = "nodejs";
const unavailable = () =>
  NextResponse.json(
    { error: "Master service unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/rooms/[roomId]/locations">,
) {
  try {
    return await handleGetLocations(
      request,
      (await ctx.params).roomId,
      getSessionRepository(),
      getMasterRepository(),
    );
  } catch {
    return unavailable();
  }
}
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/rooms/[roomId]/locations">,
) {
  try {
    return await handleCreateLocation(
      request,
      (await ctx.params).roomId,
      getSessionRepository(),
      getMasterRepository(),
    );
  } catch {
    return unavailable();
  }
}
