import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "../session/cookie";
import {
  resolveSession,
  type SessionRepository,
} from "../../services/session.service";
import {
  createWorkOverride,
  deleteWorkOverride,
  getWorkOverrides,
  getWorkPattern,
  patchWorkOverride,
  putWorkPattern,
  WorkScheduleError,
  type WorkScheduleRepository,
} from "../../services/work-schedule.service";

const headers = { "Cache-Control": "no-store" };
function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers });
}
function failure(error: unknown) {
  if (error instanceof WorkScheduleError) {
    const status =
      error.code === "INVALID_INPUT"
        ? 400
        : error.code === "DUPLICATE"
          ? 409
          : 404;
    return json({ error: error.message, code: error.code }, status);
  }
  return json({ error: "Work calendar service unavailable" }, 503);
}
async function currentUserId(
  request: NextRequest,
  sessions: SessionRepository,
) {
  const user = await resolveSession(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    sessions,
  );
  return user?.id ?? null;
}
async function body(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new WorkScheduleError("INVALID_INPUT", "Enter valid JSON");
  }
}

export async function handleGetWorkPattern(
  request: NextRequest,
  sessions: SessionRepository,
  repository: WorkScheduleRepository,
) {
  try {
    const userId = await currentUserId(request, sessions);
    if (!userId) return json({ error: "Unauthorized" }, 401);
    return json({ days: await getWorkPattern(userId, repository) });
  } catch (error) {
    return failure(error);
  }
}

export async function handlePutWorkPattern(
  request: NextRequest,
  sessions: SessionRepository,
  repository: WorkScheduleRepository,
) {
  try {
    const userId = await currentUserId(request, sessions);
    if (!userId) return json({ error: "Unauthorized" }, 401);
    return json({
      days: await putWorkPattern(userId, await body(request), repository),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetWorkOverrides(
  request: NextRequest,
  sessions: SessionRepository,
  repository: WorkScheduleRepository,
) {
  try {
    const userId = await currentUserId(request, sessions);
    if (!userId) return json({ error: "Unauthorized" }, 401);
    const query = request.nextUrl.searchParams;
    return json(
      await getWorkOverrides(
        userId,
        query.get("year"),
        query.get("month"),
        repository,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateWorkOverride(
  request: NextRequest,
  sessions: SessionRepository,
  repository: WorkScheduleRepository,
) {
  try {
    const userId = await currentUserId(request, sessions);
    if (!userId) return json({ error: "Unauthorized" }, 401);
    return json(
      {
        override: await createWorkOverride(
          userId,
          await body(request),
          repository,
        ),
      },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handlePatchWorkOverride(
  request: NextRequest,
  id: string,
  sessions: SessionRepository,
  repository: WorkScheduleRepository,
) {
  try {
    const userId = await currentUserId(request, sessions);
    if (!userId) return json({ error: "Unauthorized" }, 401);
    return json({
      override: await patchWorkOverride(
        userId,
        id,
        await body(request),
        repository,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function handleDeleteWorkOverride(
  request: NextRequest,
  id: string,
  sessions: SessionRepository,
  repository: WorkScheduleRepository,
) {
  try {
    const userId = await currentUserId(request, sessions);
    if (!userId) return json({ error: "Unauthorized" }, 401);
    return json({ override: await deleteWorkOverride(userId, id, repository) });
  } catch (error) {
    return failure(error);
  }
}
