import { NextResponse, type NextRequest } from "next/server";
import {
  handleCreateStatus,
  handleGetStatuses,
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
  ctx: RouteContext<"/api/rooms/[roomId]/statuses">,
) {
  try {
    return await handleGetStatuses(
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
  ctx: RouteContext<"/api/rooms/[roomId]/statuses">,
) {
  try {
    return await handleCreateStatus(
      request,
      (await ctx.params).roomId,
      getSessionRepository(),
      getMasterRepository(),
    );
  } catch {
    return unavailable();
  }
}
