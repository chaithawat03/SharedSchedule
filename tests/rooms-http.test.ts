import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "../lib/session/cookie";
import { handleLoginRequest } from "../lib/session/http";
import { signInWithPhone } from "../services/session.service";
import { MemorySessionRepository } from "./helpers/memory-session-repository";
import type { RoomRepository } from "../services/room.service";
import {
  handleCreateInvite,
  handleCreateRoom,
  handleGetRoom,
  handleInspectInvite,
  handleJoinInvite,
  handleListRooms,
} from "../lib/rooms/http";

function request(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options.method ?? "GET",
    headers: options.token
      ? { cookie: `${SESSION_COOKIE_NAME}=${options.token}` }
      : undefined,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function rooms(): RoomRepository & { members: Set<string> } {
  const members = new Set<string>();
  let room: {
    id: string;
    name: string;
    description: string | null;
    ownerUserId: string;
    status: string;
  } | null = null;
  let invite: {
    tokenHash: string;
    roomId: string;
    expiresAt: Date | null;
    maxUses: number | null;
    usedCount: number;
    status: string;
  } | null = null;
  return {
    members,
    async createRoom(input) {
      room = {
        id: "20000000-0000-4000-8000-000000000001",
        ...input,
        status: "ACTIVE",
      };
      return room;
    },
    async listRooms(userId) {
      return room && (room.ownerUserId === userId || members.has(userId))
        ? [
            {
              ...room,
              participantCount: members.size,
              isOwner: room.ownerUserId === userId,
            },
          ]
        : [];
    },
    async getRoom(id) {
      return room?.id === id
        ? {
            ...room,
            participants: [...members].map((userId) => ({
              userId,
              displayName: userId,
              role: "MEMBER",
              status: "ACTIVE",
            })),
          }
        : null;
    },
    async createInvite(input) {
      invite = {
        tokenHash: input.tokenHash,
        roomId: input.roomId,
        expiresAt: input.expiresAt,
        maxUses: input.maxUses,
        usedCount: 0,
        status: "ACTIVE",
      };
    },
    async getInvite(hash) {
      return invite?.tokenHash === hash && room
        ? { ...invite, roomName: room.name, roomStatus: room.status }
        : null;
    },
    async consumeInvite(hash, userId, now) {
      if (!invite || invite.tokenHash !== hash || !room)
        return { kind: "invalid" };
      if (invite.expiresAt && invite.expiresAt <= now)
        return { kind: "expired" };
      if (members.has(userId)) return { kind: "joined", roomId: room.id };
      if (invite.maxUses !== null && invite.usedCount >= invite.maxUses)
        return { kind: "exhausted" };
      members.add(userId);
      invite.usedCount++;
      return { kind: "joined", roomId: room.id };
    },
  };
}

async function user(
  sessionRepository: MemorySessionRepository,
  phone: string,
  name: string,
) {
  const result = await signInWithPhone(
    { phone, displayName: name },
    sessionRepository,
  );
  if (result.requiresRegistration) throw new Error("Expected login");
  return result;
}

describe("room HTTP flow", () => {
  it("rejects unauthenticated creation and lists an owner's empty room", async () => {
    const sessions = new MemorySessionRepository();
    const repo = rooms();
    const anonymous = await handleCreateRoom(
      request("/api/rooms", { method: "POST", body: { name: "Together" } }),
      sessions,
      repo,
    );
    expect(anonymous.status).toBe(401);
    const owner = await user(sessions, "0812345678", "Smart");
    const created = await handleCreateRoom(
      request("/api/rooms", {
        method: "POST",
        token: owner.token,
        body: { name: "Together" },
      }),
      sessions,
      repo,
    );
    expect(created.status).toBe(201);
    const room = (await created.json()).room;
    expect(room.ownerUserId).toBe(owner.user.id);
    expect(repo.members.size).toBe(0);
    const listed = await handleListRooms(
      request("/api/rooms", { token: owner.token }),
      sessions,
      repo,
    );
    expect((await listed.json()).rooms).toEqual([
      expect.objectContaining({ id: room.id, participantCount: 0 }),
    ]);
  });

  it("requires ownership for invites and sends an authenticated join to room detail", async () => {
    const sessions = new MemorySessionRepository();
    const repo = rooms();
    const owner = await user(sessions, "0812345678", "Smart");
    const member = await user(sessions, "0899999999", "Partner");
    const room = (
      await (
        await handleCreateRoom(
          request("/api/rooms", {
            method: "POST",
            token: owner.token,
            body: { name: "Together" },
          }),
          sessions,
          repo,
        )
      ).json()
    ).room;
    const denied = await handleCreateInvite(
      request(`/api/rooms/${room.id}/invites`, {
        method: "POST",
        token: member.token,
        body: {},
      }),
      room.id,
      sessions,
      repo,
    );
    expect(denied.status).toBe(403);
    expect(
      (
        await handleGetRoom(
          request(`/api/rooms/${room.id}`, { token: member.token }),
          room.id,
          sessions,
          repo,
        )
      ).status,
    ).toBe(404);
    const created = await handleCreateInvite(
      request(`/api/rooms/${room.id}/invites`, {
        method: "POST",
        token: owner.token,
        body: { maxUses: 1 },
      }),
      room.id,
      sessions,
      repo,
    );
    expect(created.status).toBe(201);
    const { url, token } = await created.json();
    expect(url).toBe(`http://localhost:3000/invite/${token}`);
    const inspected = await handleInspectInvite(
      request(`/api/invites/${token}`),
      token,
      repo,
    );
    expect(await inspected.json()).toEqual(
      expect.objectContaining({ kind: "valid", roomName: "Together" }),
    );
    expect(
      JSON.stringify(
        await (
          await handleInspectInvite(
            request(`/api/invites/${token}`),
            token,
            repo,
          )
        ).json(),
      ),
    ).not.toContain("tokenHash");
    expect(
      (
        await handleJoinInvite(
          request(`/api/invites/${token}/join`, { method: "POST" }),
          token,
          sessions,
          repo,
        )
      ).status,
    ).toBe(401);
    const joined = await handleJoinInvite(
      request(`/api/invites/${token}/join`, {
        method: "POST",
        token: member.token,
      }),
      token,
      sessions,
      repo,
    );
    expect(joined.status).toBe(200);
    expect(await joined.json()).toEqual({
      roomId: room.id,
      roomUrl: `/room/${room.id}`,
    });
    expect(
      (
        await handleGetRoom(
          request(`/api/rooms/${room.id}`, { token: member.token }),
          room.id,
          sessions,
          repo,
        )
      ).status,
    ).toBe(200);
    expect(repo.members.has(member.user.id)).toBe(true);
    const stillDenied = await handleCreateInvite(
      request(`/api/rooms/${room.id}/invites`, {
        method: "POST",
        token: member.token,
        body: {},
      }),
      room.id,
      sessions,
      repo,
    );
    expect(stillDenied.status).toBe(403);
  });

  it("resumes a signed-out invitation after registration and opens the invited room", async () => {
    const sessions = new MemorySessionRepository();
    const repo = rooms();
    const owner = await user(sessions, "0812345678", "Smart");
    const createdRoom = await handleCreateRoom(
      request("/api/rooms", {
        method: "POST",
        token: owner.token,
        body: { name: "Our plans" },
      }),
      sessions,
      repo,
    );
    const room = (await createdRoom.json()).room;
    const createdInvite = await handleCreateInvite(
      request(`/api/rooms/${room.id}/invites`, {
        method: "POST",
        token: owner.token,
        body: {},
      }),
      room.id,
      sessions,
      repo,
    );
    const { token } = await createdInvite.json();
    expect(
      (await handleInspectInvite(request(`/api/invites/${token}`), token, repo))
        .status,
    ).toBe(200);
    const firstLogin = await handleLoginRequest(
      request("/api/session/login", {
        method: "POST",
        body: { phone: "0899999999" },
      }),
      sessions,
    );
    expect((await firstLogin.json()).requiresRegistration).toBe(true);
    const registration = await handleLoginRequest(
      request("/api/session/login", {
        method: "POST",
        body: { phone: "0899999999", displayName: "Partner" },
      }),
      sessions,
    );
    const sessionToken = registration.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(sessionToken).toBeTruthy();
    const join = await handleJoinInvite(
      request(`/api/invites/${token}/join`, {
        method: "POST",
        token: sessionToken,
      }),
      token,
      sessions,
      repo,
    );
    expect(await join.json()).toEqual({
      roomId: room.id,
      roomUrl: `/room/${room.id}`,
    });
    expect(
      (
        await handleGetRoom(
          request(`/api/rooms/${room.id}`, { token: sessionToken }),
          room.id,
          sessions,
          repo,
        )
      ).status,
    ).toBe(200);
  });
});
