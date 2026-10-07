import type { NextRequest } from "next/server";
import {
  handleDeleteWorkOverride,
  handlePatchWorkOverride,
} from "../../../../../lib/work-schedule/http";
import { getWorkScheduleRepository } from "../../../../../lib/work-schedule/repository";
import { getSessionRepository } from "../../../../../lib/session/repository";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/me/work-overrides/[id]">,
) {
  const { id } = await ctx.params;
  return handlePatchWorkOverride(
    request,
    id,
    getSessionRepository(),
    getWorkScheduleRepository(),
  );
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/me/work-overrides/[id]">,
) {
  const { id } = await ctx.params;
  return handleDeleteWorkOverride(
    request,
    id,
    getSessionRepository(),
    getWorkScheduleRepository(),
  );
}
