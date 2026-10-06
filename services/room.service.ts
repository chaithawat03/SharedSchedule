import { createHash, randomBytes } from "node:crypto";

export type RoomRecord = {
  id: string;
  name: string;
  description: string | null;
  ownerUserId: string;
  status: string;
};

export type RoomParticipant = {
  userId: string;
  displayName: string;
  role: string;
  status: string;
};

export type RoomDetail = RoomRecord & { participants: RoomParticipant[] };
export type RoomSummary = RoomRecord & {
  participantCount: number;
  isOwner: boolean;
};

export type InviteRecord = {
  roomId: string;
  roomName: string;
  roomStatus: string;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  status: string;
};

export type InviteState =
  | {
      kind: "valid";
      roomId: string;
      roomName: string;
      expiresAt: Date | null;
      usesRemaining: number | null;
    }
  | { kind: "invalid" | "expired" | "exhausted" };

export type JoinOutcome =
  | { kind: "joined"; roomId: string }
  | { kind: "invalid" | "expired" | "exhausted" };

export interface RoomRepository {
  createRoom(input: {
    ownerUserId: string;
    name: string;
    description: string | null;
  }): Promise<RoomRecord>;
  listRooms(userId: string): Promise<RoomSummary[]>;
  getRoom(roomId: string): Promise<RoomDetail | null>;
  createInvite(input: {
    roomId: string;
    createdBy: string;
    tokenHash: string;
    expiresAt: Date | null;
    maxUses: number | null;
  }): Promise<void>;
  getInvite(tokenHash: string): Promise<InviteRecord | null>;
  consumeInvite(
    tokenHash: string,
    userId: string,
    now: Date,
  ): Promise<JoinOutcome>;
}

export type RoomErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_INVITE"
  | "EXPIRED"
  | "EXHAUSTED";

export class RoomError extends Error {
  constructor(
    public readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const roomIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireRoomId(roomId: string) {
  if (!roomIdPattern.test(roomId))
    throw new RoomError("NOT_FOUND", "Room not found");
}

function validateRoomInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RoomError("INVALID_INPUT", "Enter a room name");
  }
  const value = input as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || name.length > 160 || /[\x00-\x1f\x7f]/.test(name)) {
    throw new RoomError(
      "INVALID_INPUT",
      "Enter a room name (up to 160 characters)",
    );
  }
  const description =
    value.description === undefined || value.description === null
      ? null
      : value.description;
  if (
    description !== null &&
    (typeof description !== "string" || description.length > 2000)
  ) {
    throw new RoomError("INVALID_INPUT", "Description is too long");
  }
  return {
    name,
    description:
      typeof description === "string" ? description.trim() || null : null,
  };
}

function validateInviteInput(input: unknown, now: Date) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RoomError("INVALID_INPUT", "Invalid invite options");
  }
  const value = input as Record<string, unknown>;
  let expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (value.expiresAt !== undefined && value.expiresAt !== null) {
    if (
      typeof value.expiresAt !== "string" ||
      !/^\d{4}-\d\d-\d\dT/.test(value.expiresAt)
    ) {
      throw new RoomError("INVALID_INPUT", "Enter a future expiry date");
    }
    expiresAt = new Date(value.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
      throw new RoomError("INVALID_INPUT", "Enter a future expiry date");
    }
  }
  const maxUses =
    value.maxUses === undefined || value.maxUses === null
      ? null
      : value.maxUses;
  if (
    maxUses !== null &&
    (!Number.isSafeInteger(maxUses) ||
      (maxUses as number) < 1 ||
      (maxUses as number) > 2147483647)
  ) {
    throw new RoomError(
      "INVALID_INPUT",
      "Usage limit must be a positive integer",
    );
  }
  return { expiresAt, maxUses: maxUses as number | null };
}

export function isInviteToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function classifyInvite(
  invite: InviteRecord | null,
  now: Date,
): InviteState {
  if (!invite || invite.status !== "ACTIVE" || invite.roomStatus !== "ACTIVE")
    return { kind: "invalid" };
  if (invite.expiresAt && invite.expiresAt <= now) return { kind: "expired" };
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses)
    return { kind: "exhausted" };
  return {
    kind: "valid",
    roomId: invite.roomId,
    roomName: invite.roomName,
    expiresAt: invite.expiresAt,
    usesRemaining:
      invite.maxUses === null ? null : invite.maxUses - invite.usedCount,
  };
}

export async function createRoom(
  userId: string,
  input: unknown,
  repository: RoomRepository,
) {
  const values = validateRoomInput(input);
  return repository.createRoom({ ownerUserId: userId, ...values });
}

export async function listRooms(userId: string, repository: RoomRepository) {
  return repository.listRooms(userId);
}

export async function getRoom(
  userId: string,
  roomId: string,
  repository: RoomRepository,
) {
  requireRoomId(roomId);
  const room = await repository.getRoom(roomId);
  if (
    !room ||
    room.status !== "ACTIVE" ||
    (room.ownerUserId !== userId &&
      !room.participants.some(
        (member) => member.userId === userId && member.status === "ACTIVE",
      ))
  ) {
    throw new RoomError("NOT_FOUND", "Room not found");
  }
  return room;
}

export async function createRoomInvite(
  userId: string,
  roomId: string,
  input: unknown,
  repository: RoomRepository,
  now = new Date(),
) {
  requireRoomId(roomId);
  const room = await repository.getRoom(roomId);
  if (!room || room.status !== "ACTIVE")
    throw new RoomError("NOT_FOUND", "Room not found");
  if (room.ownerUserId !== userId)
    throw new RoomError("FORBIDDEN", "Only the room owner can create invites");
  const options = validateInviteInput(input, now);
  const token = randomBytes(32).toString("base64url");
  await repository.createInvite({
    roomId,
    createdBy: userId,
    tokenHash: hashInviteToken(token),
    ...options,
  });
  return { token, expiresAt: options.expiresAt, maxUses: options.maxUses };
}

export async function inspectInvite(
  token: unknown,
  repository: RoomRepository,
  now = new Date(),
): Promise<InviteState> {
  if (!isInviteToken(token)) return { kind: "invalid" };
  return classifyInvite(
    await repository.getInvite(hashInviteToken(token)),
    now,
  );
}

export async function joinRoomInvite(
  userId: string,
  token: unknown,
  repository: RoomRepository,
  now = new Date(),
) {
  if (!isInviteToken(token))
    throw new RoomError("INVALID_INVITE", "Invite link is invalid");
  const result = await repository.consumeInvite(
    hashInviteToken(token),
    userId,
    now,
  );
  if (result.kind === "joined") return { roomId: result.roomId };
  const messages = {
    invalid: "Invite link is invalid",
    expired: "Invite link has expired",
    exhausted: "Invite link has reached its usage limit",
  };
  throw new RoomError(
    result.kind === "invalid"
      ? "INVALID_INVITE"
      : (result.kind.toUpperCase() as "EXPIRED" | "EXHAUSTED"),
    messages[result.kind],
  );
}
