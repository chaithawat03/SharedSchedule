import { NextResponse, type NextRequest } from "next/server";
import type { SessionRepository } from "../../services/session.service";
import { resolveSession } from "../../services/session.service";
import {
  createRoom,
  createRoomInvite,
  getRoom,
  inspectInvite,
  joinRoomInvite,
  listRooms,
  RoomError,
  type RoomRepository,
} from "../../services/room.service";
import { SESSION_COOKIE_NAME } from "../session/cookie";

const noStore = { "Cache-Control": "no-store" };
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: noStore });
}

function failure(error: unknown) {
  if (error instanceof RoomError) {
    const status =
      error.code === "INVALID_INPUT"
        ? 400
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "EXPIRED" || error.code === "EXHAUSTED"
            ? 410
            : 404;
    return json({ error: error.message, code: error.code }, status);
  }
  return json({ error: "Room service unavailable" }, 500);
}

async function currentUser(request: NextRequest, sessions: SessionRepository) {
  return resolveSession(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    sessions,
  );
}

async function body(request: NextRequest) {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new RoomError("INVALID_INPUT", "Enter valid JSON");
  }
}

function validateRoomId(roomId: string) {
  if (!uuidPattern.test(roomId))
    throw new RoomError("NOT_FOUND", "Room not found");
}

export async function handleListRooms(
  request: NextRequest,
  sessions: SessionRepository,
  repository: RoomRepository,
) {
  try {
    const user = await currentUser(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    return json({ rooms: await listRooms(user.id, repository) });
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateRoom(
  request: NextRequest,
  sessions: SessionRepository,
  repository: RoomRepository,
) {
  try {
    const user = await currentUser(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    return json(
      { room: await createRoom(user.id, await body(request), repository) },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleGetRoom(
  request: NextRequest,
  roomId: string,
  sessions: SessionRepository,
  repository: RoomRepository,
) {
  try {
    const user = await currentUser(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    validateRoomId(roomId);
    const room = await getRoom(user.id, roomId, repository);
    return json({ room: { ...room, isOwner: room.ownerUserId === user.id } });
  } catch (error) {
    return failure(error);
  }
}

export async function handleCreateInvite(
  request: NextRequest,
  roomId: string,
  sessions: SessionRepository,
  repository: RoomRepository,
) {
  try {
    const user = await currentUser(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    validateRoomId(roomId);
    const invite = await createRoomInvite(
      user.id,
      roomId,
      await body(request),
      repository,
    );
    return json(
      { ...invite, url: `${request.nextUrl.origin}/invite/${invite.token}` },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleInspectInvite(
  _request: NextRequest,
  token: string,
  repository: RoomRepository,
) {
  try {
    const invite = await inspectInvite(token, repository);
    return json(
      invite,
      invite.kind === "valid" ? 200 : invite.kind === "invalid" ? 404 : 410,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleJoinInvite(
  request: NextRequest,
  token: string,
  sessions: SessionRepository,
  repository: RoomRepository,
) {
  try {
    const user = await currentUser(request, sessions);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const result = await joinRoomInvite(user.id, token, repository);
    return json({ ...result, roomUrl: `/room/${result.roomId}` });
  } catch (error) {
    return failure(error);
  }
}
