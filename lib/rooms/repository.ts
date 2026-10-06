import { and, count, eq, inArray, or } from "drizzle-orm";
import { createDatabase, getDatabase } from "../db";
import { auditLog, roomInvites, roomMembers, rooms, users } from "../db/schema";
import {
  classifyInvite,
  type RoomRepository,
} from "../../services/room.service";

type Database = ReturnType<typeof createDatabase>["db"];

export function createRoomRepository(db: Database): RoomRepository {
  return {
    async createRoom(input) {
      return db.transaction(async (tx) => {
        const [room] = await tx.insert(rooms).values(input).returning();
        await tx.insert(auditLog).values({
          userId: input.ownerUserId,
          roomId: room.id,
          action: "CREATE_ROOM",
          entityType: "ROOM",
          entityId: room.id,
          newValue: { name: room.name },
        });
        return room;
      });
    },

    async listRooms(userId) {
      const rows = await db
        .select({
          id: rooms.id,
          name: rooms.name,
          description: rooms.description,
          ownerUserId: rooms.ownerUserId,
          status: rooms.status,
        })
        .from(rooms)
        .leftJoin(
          roomMembers,
          and(
            eq(roomMembers.roomId, rooms.id),
            eq(roomMembers.userId, userId),
            eq(roomMembers.status, "ACTIVE"),
          ),
        )
        .where(
          and(
            eq(rooms.status, "ACTIVE"),
            or(eq(rooms.ownerUserId, userId), eq(roomMembers.userId, userId)),
          ),
        )
        .orderBy(rooms.createdAt);
      if (rows.length === 0) return [];
      const counts = await db
        .select({ roomId: roomMembers.roomId, total: count() })
        .from(roomMembers)
        .where(
          and(
            inArray(
              roomMembers.roomId,
              rows.map((room) => room.id),
            ),
            eq(roomMembers.status, "ACTIVE"),
          ),
        )
        .groupBy(roomMembers.roomId);
      const byRoom = new Map(counts.map((item) => [item.roomId, item.total]));
      return rows.map((room) => ({
        ...room,
        participantCount: byRoom.get(room.id) ?? 0,
        isOwner: room.ownerUserId === userId,
      }));
    },

    async getRoom(roomId) {
      const [room] = await db
        .select({
          id: rooms.id,
          name: rooms.name,
          description: rooms.description,
          ownerUserId: rooms.ownerUserId,
          status: rooms.status,
        })
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);
      if (!room) return null;
      const participants = await db
        .select({
          userId: roomMembers.userId,
          displayName: users.displayName,
          role: roomMembers.role,
          status: roomMembers.status,
        })
        .from(roomMembers)
        .innerJoin(users, eq(users.id, roomMembers.userId))
        .where(
          and(eq(roomMembers.roomId, roomId), eq(roomMembers.status, "ACTIVE")),
        )
        .orderBy(roomMembers.joinedAt);
      return { ...room, participants };
    },

    async createInvite(input) {
      await db.transaction(async (tx) => {
        const [invite] = await tx
          .insert(roomInvites)
          .values(input)
          .returning({ id: roomInvites.id });
        await tx.insert(auditLog).values({
          userId: input.createdBy,
          roomId: input.roomId,
          action: "CREATE_INVITE",
          entityType: "ROOM_INVITE",
          entityId: invite.id,
          newValue: {
            expiresAt: input.expiresAt?.toISOString() ?? null,
            maxUses: input.maxUses,
          },
        });
      });
    },

    async getInvite(tokenHash) {
      const [row] = await db
        .select({
          roomId: roomInvites.roomId,
          roomName: rooms.name,
          roomStatus: rooms.status,
          expiresAt: roomInvites.expiresAt,
          maxUses: roomInvites.maxUses,
          usedCount: roomInvites.usedCount,
          status: roomInvites.status,
        })
        .from(roomInvites)
        .innerJoin(rooms, eq(rooms.id, roomInvites.roomId))
        .where(eq(roomInvites.tokenHash, tokenHash))
        .limit(1);
      return row ?? null;
    },

    async consumeInvite(tokenHash, userId, now) {
      return db.transaction(async (tx) => {
        const [invite] = await tx
          .select({
            id: roomInvites.id,
            roomId: roomInvites.roomId,
            roomName: rooms.name,
            roomStatus: rooms.status,
            expiresAt: roomInvites.expiresAt,
            maxUses: roomInvites.maxUses,
            usedCount: roomInvites.usedCount,
            status: roomInvites.status,
          })
          .from(roomInvites)
          .innerJoin(rooms, eq(rooms.id, roomInvites.roomId))
          .where(eq(roomInvites.tokenHash, tokenHash))
          .for("update", { of: roomInvites });
        if (!invite) return { kind: "invalid" as const };
        const state = classifyInvite(invite, now);
        if (state.kind === "invalid") return { kind: "invalid" as const };

        const [existing] = await tx
          .select({ id: roomMembers.id, status: roomMembers.status })
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, invite.roomId),
              eq(roomMembers.userId, userId),
            ),
          )
          .limit(1);
        if (existing?.status === "ACTIVE")
          return { kind: "joined" as const, roomId: invite.roomId };
        if (state.kind === "expired") return { kind: "expired" as const };
        if (state.kind === "exhausted") return { kind: "exhausted" as const };

        let membershipId: string | null = null;
        if (existing) {
          const updated = await tx
            .update(roomMembers)
            .set({ status: "ACTIVE", role: "MEMBER", joinedAt: now })
            .where(
              and(
                eq(roomMembers.id, existing.id),
                eq(roomMembers.status, existing.status),
              ),
            )
            .returning({ id: roomMembers.id });
          membershipId = updated[0]?.id ?? null;
        } else {
          const inserted = await tx
            .insert(roomMembers)
            .values({
              roomId: invite.roomId,
              userId,
              role: "MEMBER",
              status: "ACTIVE",
              joinedAt: now,
            })
            .onConflictDoNothing({
              target: [roomMembers.roomId, roomMembers.userId],
            })
            .returning({ id: roomMembers.id });
          membershipId = inserted[0]?.id ?? null;
        }
        if (membershipId) {
          await tx
            .update(roomInvites)
            .set({ usedCount: invite.usedCount + 1 })
            .where(eq(roomInvites.id, invite.id));
          await tx.insert(auditLog).values({
            userId,
            roomId: invite.roomId,
            action: "JOIN_ROOM",
            entityType: "ROOM_MEMBER",
            entityId: membershipId,
            newValue: { role: "MEMBER", inviteId: invite.id },
          });
        }
        return { kind: "joined" as const, roomId: invite.roomId };
      });
    },
  };
}

export function getRoomRepository(): RoomRepository {
  return createRoomRepository(getDatabase().db);
}
