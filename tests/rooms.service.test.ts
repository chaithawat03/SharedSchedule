import { describe, expect, it } from "vitest";
import {
  createRoom,
  createRoomInvite,
  getRoom,
  inspectInvite,
  joinOwnerAsParticipant,
  joinRoomInvite,
  listRooms,
  type RoomRepository,
} from "../services/room.service";

const now = new Date("2026-10-06T00:00:00.000Z");
const owner = "10000000-0000-4000-8000-000000000001";
const member = "10000000-0000-4000-8000-000000000002";
const stranger = "10000000-0000-4000-8000-000000000003";
const roomId = "20000000-0000-4000-8000-000000000001";

class MemoryRooms implements RoomRepository {
  rooms = new Map<
    string,
    {
      id: string;
      name: string;
      description: string | null;
      ownerUserId: string;
      status: string;
    }
  >();
  memberships = new Map<string, Set<string>>();
  invites = new Map<
    string,
    {
      roomId: string;
      expiresAt: Date | null;
      maxUses: number | null;
      usedCount: number;
      status: string;
    }
  >();

  async createRoom(input: {
    ownerUserId: string;
    name: string;
    description: string | null;
  }) {
    const room = { id: roomId, ...input, status: "ACTIVE" };
    this.rooms.set(room.id, room);
    return room;
  }
  async listRooms(userId: string) {
    return [...this.rooms.values()]
      .filter(
        (room) =>
          room.ownerUserId === userId ||
          this.memberships.get(room.id)?.has(userId),
      )
      .map((room) => ({
        ...room,
        participantCount: this.memberships.get(room.id)?.size ?? 0,
        isOwner: room.ownerUserId === userId,
      }));
  }
  async getRoom(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new Error("PostgreSQL rejected malformed UUID");
    const room = this.rooms.get(id);
    return room
      ? {
          ...room,
          participants: [...(this.memberships.get(id) ?? [])].map((id) => ({
            userId: id,
            displayName: id,
            role: "MEMBER",
            status: "ACTIVE",
          })),
        }
      : null;
  }
  async createInvite(input: {
    roomId: string;
    tokenHash: string;
    expiresAt: Date | null;
    maxUses: number | null;
  }) {
    this.invites.set(input.tokenHash, {
      roomId: input.roomId,
      expiresAt: input.expiresAt,
      maxUses: input.maxUses,
      usedCount: 0,
      status: "ACTIVE",
    });
  }
  async addOwnerParticipant(id: string, userId: string) {
    const room = this.rooms.get(id);
    if (!room || room.status !== "ACTIVE") return { kind: "notFound" as const };
    if (room.ownerUserId !== userId) return { kind: "forbidden" as const };
    const members = this.memberships.get(id) ?? new Set<string>();
    members.add(userId);
    this.memberships.set(id, members);
    return { kind: "joined" as const, roomId: id };
  }
  async getInvite(hash: string) {
    const invite = this.invites.get(hash);
    const room = invite && this.rooms.get(invite.roomId);
    return invite && room
      ? { ...invite, roomName: room.name, roomStatus: room.status }
      : null;
  }
  async consumeInvite(hash: string, userId: string, at: Date) {
    const invite = await this.getInvite(hash);
    if (!invite) return { kind: "invalid" as const };
    if (invite.status !== "ACTIVE" || invite.roomStatus !== "ACTIVE")
      return { kind: "invalid" as const };
    const members = this.memberships.get(invite.roomId) ?? new Set<string>();
    if (members.has(userId))
      return { kind: "joined" as const, roomId: invite.roomId };
    if (invite.expiresAt && invite.expiresAt <= at)
      return { kind: "expired" as const };
    if (invite.maxUses !== null && invite.usedCount >= invite.maxUses)
      return { kind: "exhausted" as const };
    members.add(userId);
    this.memberships.set(invite.roomId, members);
    invite.usedCount++;
    this.invites.set(hash, invite);
    return { kind: "joined" as const, roomId: invite.roomId };
  }
}

describe("rooms", () => {
  it("creates a named room without inserting its owner as a participant", async () => {
    const repo = new MemoryRooms();
    const room = await createRoom(owner, { name: "  Our plans  " }, repo);
    expect(room.name).toBe("Our plans");
    expect(room.ownerUserId).toBe(owner);
    expect(repo.memberships.get(room.id)).toBeUndefined();
  });

  it("rejects an empty room name", async () => {
    await expect(
      createRoom(owner, { name: "  " }, new MemoryRooms()),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("lists owned and joined rooms once each and gates room detail", async () => {
    const repo = new MemoryRooms();
    await createRoom(owner, { name: "Together" }, repo);
    repo.memberships.set(roomId, new Set([owner, member]));
    expect(await listRooms(owner, repo)).toHaveLength(1);
    expect((await listRooms(owner, repo))[0].participantCount).toBe(2);
    expect((await getRoom(owner, roomId, repo)).participants).toHaveLength(2);
    expect((await getRoom(member, roomId, repo)).id).toBe(roomId);
    expect((await listRooms(member, repo)).map((room) => room.id)).toEqual([
      roomId,
    ]);
    await expect(getRoom(stranger, roomId, repo)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects malformed room IDs before querying PostgreSQL", async () => {
    const repo = new MemoryRooms();
    await expect(getRoom(owner, "not-a-uuid", repo)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      createRoomInvite(owner, "not-a-uuid", {}, repo, now),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets the owner explicitly join as a participant without an invite or duplicate membership", async () => {
    const repo = new MemoryRooms();
    await createRoom(owner, { name: "Together" }, repo);
    expect(repo.memberships.get(roomId)).toBeUndefined();
    expect(await joinOwnerAsParticipant(owner, roomId, repo)).toEqual({
      roomId,
    });
    expect((await getRoom(owner, roomId, repo)).participants).toEqual([
      { userId: owner, displayName: owner, role: "MEMBER", status: "ACTIVE" },
    ]);
    expect(await joinOwnerAsParticipant(owner, roomId, repo)).toEqual({
      roomId,
    });
    expect(repo.memberships.get(roomId)?.size).toBe(1);
    expect(repo.invites.size).toBe(0);
  });

  it("rejects nonowners and inactive rooms for explicit participant joining", async () => {
    const repo = new MemoryRooms();
    await createRoom(owner, { name: "Together" }, repo);
    repo.memberships.set(roomId, new Set([member]));
    await expect(
      joinOwnerAsParticipant(member, roomId, repo),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.memberships.get(roomId)?.has(owner)).toBe(false);
    repo.rooms.get(roomId)!.status = "INACTIVE";
    await expect(
      joinOwnerAsParticipant(owner, roomId, repo),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("invites", () => {
  it("lets only the owner create a hashed invite", async () => {
    const repo = new MemoryRooms();
    await createRoom(owner, { name: "Together" }, repo);
    await expect(
      createRoomInvite(member, roomId, {}, repo, now),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const invite = await createRoomInvite(
      owner,
      roomId,
      { maxUses: 1 },
      repo,
      now,
    );
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...repo.invites.keys()][0]).not.toBe(invite.token);
    expect(invite.expiresAt.toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });

  it("distinguishes invalid, expired, and exhausted links", async () => {
    const repo = new MemoryRooms();
    await createRoom(owner, { name: "Together" }, repo);
    expect((await inspectInvite("invalid", repo, now)).kind).toBe("invalid");
    await expect(
      joinRoomInvite(member, "invalid", repo, now),
    ).rejects.toMatchObject({ code: "INVALID_INVITE" });
    const invite = await createRoomInvite(
      owner,
      roomId,
      { maxUses: 1 },
      repo,
      now,
    );
    expect((await inspectInvite(invite.token, repo, now)).kind).toBe("valid");
    await joinRoomInvite(member, invite.token, repo, now);
    expect((await inspectInvite(invite.token, repo, now)).kind).toBe(
      "exhausted",
    );
    expect(
      (
        await inspectInvite(
          invite.token,
          repo,
          new Date("2026-10-14T00:00:00.000Z"),
        )
      ).kind,
    ).toBe("expired");
  });

  it("joins as MEMBER and does not consume another use on repeat", async () => {
    const repo = new MemoryRooms();
    await createRoom(owner, { name: "Together" }, repo);
    const invite = await createRoomInvite(
      owner,
      roomId,
      { maxUses: 1 },
      repo,
      now,
    );
    expect(await joinRoomInvite(member, invite.token, repo, now)).toEqual({
      roomId,
    });
    expect((await getRoom(owner, roomId, repo)).participants).toEqual([
      { userId: member, displayName: member, role: "MEMBER", status: "ACTIVE" },
    ]);
    expect(await joinRoomInvite(member, invite.token, repo, now)).toEqual({
      roomId,
    });
    expect([...repo.invites.values()][0].usedCount).toBe(1);
    await expect(
      joinRoomInvite(stranger, invite.token, repo, now),
    ).rejects.toMatchObject({ code: "EXHAUSTED" });
  });

  it("lets an existing member reopen an expired link without using it again", async () => {
    const repo = new MemoryRooms();
    await createRoom(owner, { name: "Together" }, repo);
    const invite = await createRoomInvite(
      owner,
      roomId,
      { maxUses: 2 },
      repo,
      now,
    );
    await joinRoomInvite(member, invite.token, repo, now);
    expect(
      await joinRoomInvite(
        member,
        invite.token,
        repo,
        new Date("2026-10-14T00:00:00.000Z"),
      ),
    ).toEqual({ roomId });
    expect([...repo.invites.values()][0].usedCount).toBe(1);
    await expect(
      joinRoomInvite(
        stranger,
        invite.token,
        repo,
        new Date("2026-10-14T00:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "EXPIRED" });
  });

  it("rejects inactive rooms and invalid invite limits", async () => {
    const repo = new MemoryRooms();
    await createRoom(owner, { name: "Together" }, repo);
    await expect(
      createRoomInvite(owner, roomId, { maxUses: 0 }, repo, now),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      createRoomInvite(owner, roomId, { maxUses: 1.5 }, repo, now),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const invite = await createRoomInvite(owner, roomId, {}, repo, now);
    repo.rooms.get(roomId)!.status = "INACTIVE";
    await expect(
      createRoomInvite(owner, roomId, {}, repo, now),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await inspectInvite(invite.token, repo, now)).kind).toBe("invalid");
    await expect(
      joinRoomInvite(member, invite.token, repo, now),
    ).rejects.toMatchObject({ code: "INVALID_INVITE" });
  });
});
