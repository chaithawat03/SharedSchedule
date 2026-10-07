import type { NextRequest } from "next/server";
import {
  handleCreateWorkOverride,
  handleGetWorkOverrides,
} from "../../../../lib/work-schedule/http";
import { getWorkScheduleRepository } from "../../../../lib/work-schedule/repository";
import { getSessionRepository } from "../../../../lib/session/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleGetWorkOverrides(
    request,
    getSessionRepository(),
    getWorkScheduleRepository(),
  );
}

export async function POST(request: NextRequest) {
  return handleCreateWorkOverride(
    request,
    getSessionRepository(),
    getWorkScheduleRepository(),
  );
}
