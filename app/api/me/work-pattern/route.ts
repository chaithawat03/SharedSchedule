import type { NextRequest } from "next/server";
import {
  handleGetWorkPattern,
  handlePutWorkPattern,
} from "../../../../lib/work-schedule/http";
import { getWorkScheduleRepository } from "../../../../lib/work-schedule/repository";
import { getSessionRepository } from "../../../../lib/session/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleGetWorkPattern(
    request,
    getSessionRepository(),
    getWorkScheduleRepository(),
  );
}

export async function PUT(request: NextRequest) {
  return handlePutWorkPattern(
    request,
    getSessionRepository(),
    getWorkScheduleRepository(),
  );
}
