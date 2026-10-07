import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "../session/cookie";
import {
  resolveSession,
  type SessionRepository,
} from "../../services/session.service";
import {
  assertMasterOwner,
  createLocation,
  createStatus,
  deleteLocation,
  deleteStatus,
  listLocations,
  listStatuses,
  MasterError,
  patchLocation,
  patchStatus,
  putStatusOrder,
  type MasterRepository,
} from "../../services/master-data.service";

const headers = { "Cache-Control": "no-store" };
function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers });
}
function failure(error: unknown) {
  if (error instanceof MasterError) {
    const status =
      error.code === "INVALID_INPUT"
        ? 400
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : 409;
    return json({ error: error.message, code: error.code }, status);
  }
  return json({ error: "Master service unavailable" }, 503);
}

async function body(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new MasterError("INVALID_INPUT", "Enter valid JSON");
  }
}

async function respond(
  request: NextRequest,
  sessions: SessionRepository,
  run: (userId: string) => Promise<NextResponse>,
) {
  try {
    const user = await resolveSession(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
      sessions,
    );
    if (!user) return json({ error: "Unauthorized" }, 401);
    return await run(user.id);
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetStatuses(
  request: NextRequest,
  roomId: string,
  sessions: SessionRepository,
  repo: MasterRepository,
) {
  return respond(request, sessions, async (user) =>
    json({
      statuses: await listStatuses(
        user,
        roomId,
        request.nextUrl.searchParams.get("includeInactive") === "1",
        repo,
      ),
    }),
  );
}
export async function handleCreateStatus(
  request: NextRequest,
  roomId: string,
  sessions: SessionRepository,
  repo: MasterRepository,
) {
  return respond(request, sessions, async (user) => {
    await assertMasterOwner(user, roomId, repo);
    return json(
      { status: await createStatus(user, roomId, await body(request), repo) },
      201,
    );
  });
}
export async function handlePatchStatus(
  request: NextRequest,
  roomId: string,
  statusId: string,
  sessions: SessionRepository,
  repo: MasterRepository,
) {
  return respond(request, sessions, async (user) => {
    await assertMasterOwner(user, roomId, repo);
    return json({
      status: await patchStatus(
        user,
        roomId,
        statusId,
        await body(request),
        repo,
      ),
    });
  });
}
export async function handleDeleteStatus(
  request: NextRequest,
  roomId: string,
  statusId: string,
  sessions: SessionRepository,
  repo: MasterRepository,
) {
  return respond(request, sessions, async (user) => {
    await assertMasterOwner(user, roomId, repo);
    return json({ status: await deleteStatus(user, roomId, statusId, repo) });
  });
}
export async function handlePutStatusOrder(
  request: NextRequest,
  roomId: string,
  sessions: SessionRepository,
  repo: MasterRepository,
) {
  return respond(request, sessions, async (user) => {
    await assertMasterOwner(user, roomId, repo);
    return json({
      statuses: await putStatusOrder(user, roomId, await body(request), repo),
    });
  });
}
export async function handleGetLocations(
  request: NextRequest,
  roomId: string,
  sessions: SessionRepository,
  repo: MasterRepository,
) {
  return respond(request, sessions, async (user) =>
    json({
      locations: await listLocations(
        user,
        roomId,
        request.nextUrl.searchParams.get("includeInactive") === "1",
        repo,
      ),
    }),
  );
}
export async function handleCreateLocation(
  request: NextRequest,
  roomId: string,
  sessions: SessionRepository,
  repo: MasterRepository,
) {
  return respond(request, sessions, async (user) => {
    await assertMasterOwner(user, roomId, repo);
    return json(
      {
        location: await createLocation(user, roomId, await body(request), repo),
      },
      201,
    );
  });
}
export async function handlePatchLocation(
  request: NextRequest,
  roomId: string,
  locationId: string,
  sessions: SessionRepository,
  repo: MasterRepository,
) {
  return respond(request, sessions, async (user) => {
    await assertMasterOwner(user, roomId, repo);
    return json({
      location: await patchLocation(
        user,
        roomId,
        locationId,
        await body(request),
        repo,
      ),
    });
  });
}
export async function handleDeleteLocation(
  request: NextRequest,
  roomId: string,
  locationId: string,
  sessions: SessionRepository,
  repo: MasterRepository,
) {
  return respond(request, sessions, async (user) => {
    await assertMasterOwner(user, roomId, repo);
    return json({
      location: await deleteLocation(user, roomId, locationId, repo),
    });
  });
}
