import { and, eq, inArray, isNull } from "drizzle-orm";
import { createDatabase, getDatabase } from "../db";
import {
  auditLog,
  events,
  locationMaster,
  notifications,
  roomMembers,
  rooms,
  statusMaster,
} from "../db/schema";
import type { NotificationWriter } from "../../services/notification.service";
import type {
  EventRepository,
  EventTransaction,
} from "../../services/event.service";
import type {
  BulkEventRepository,
  BulkEventTransaction,
} from "../../services/bulk-event.service";

type Database = ReturnType<typeof createDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function notificationWriter(tx: Transaction): NotificationWriter {
  return {
    async recipients(roomId) {
      const [room] = await tx
        .select({ ownerUserId: rooms.ownerUserId })
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);
      if (!room) throw new Error("Room missing while publishing notifications");
      const members = await tx
        .select({ userId: roomMembers.userId })
        .from(roomMembers)
        .where(
          and(eq(roomMembers.roomId, roomId), eq(roomMembers.status, "ACTIVE")),
        );
      return [room.ownerUserId, ...members.map((member) => member.userId)];
    },
    async insert(rows) {
      await tx.insert(notifications).values(rows);
    },
  };
}

export function createEventRepository(
  db: Database,
): EventRepository & BulkEventRepository {
  return {
    transaction(run) {
      return db.transaction(async (tx) => {
        const store: EventTransaction = {
          async roomAccess(roomId, userId) {
            const [room] = await tx
              .select({ id: rooms.id, status: rooms.status })
              .from(rooms)
              .where(eq(rooms.id, roomId))
              .limit(1)
              .for("share");
            if (!room) return null;
            const [member] = await tx
              .select({ status: roomMembers.status })
              .from(roomMembers)
              .where(
                and(
                  eq(roomMembers.roomId, room.id),
                  eq(roomMembers.userId, userId),
                ),
              )
              .limit(1)
              .for("share");
            return {
              active: room.status === "ACTIVE",
              memberActive: member?.status === "ACTIVE",
            };
          },
          async event(eventId) {
            const [row] = await tx
              .select()
              .from(events)
              .where(eq(events.id, eventId))
              .limit(1)
              .for("update");
            return row ?? null;
          },
          async status(statusId) {
            const [row] = await tx
              .select({
                roomId: statusMaster.roomId,
                active: statusMaster.active,
              })
              .from(statusMaster)
              .where(eq(statusMaster.id, statusId))
              .limit(1)
              .for("share");
            return row ?? null;
          },
          async location(locationId) {
            const [row] = await tx
              .select({
                roomId: locationMaster.roomId,
                active: locationMaster.active,
              })
              .from(locationMaster)
              .where(eq(locationMaster.id, locationId))
              .limit(1)
              .for("share");
            return row ?? null;
          },
          async insert(input) {
            const [row] = await tx.insert(events).values(input).returning();
            return row;
          },
          async replace(before, values, at) {
            const [row] = await tx
              .update(events)
              .set({ ...values, updatedAt: at })
              .where(
                and(
                  eq(events.id, before.id),
                  eq(events.ownerUserId, before.ownerUserId),
                  isNull(events.deletedAt),
                ),
              )
              .returning();
            if (!row) throw new Error("Event changed during update");
            return row;
          },
          async softDelete(before, at) {
            const [row] = await tx
              .update(events)
              .set({ deletedAt: at, updatedAt: at })
              .where(
                and(
                  eq(events.id, before.id),
                  eq(events.ownerUserId, before.ownerUserId),
                  isNull(events.deletedAt),
                ),
              )
              .returning();
            if (!row) throw new Error("Event changed during delete");
            return row;
          },
          async audit(action, oldValue, newValue) {
            await tx.insert(auditLog).values({
              userId: newValue.ownerUserId,
              roomId: newValue.roomId,
              action,
              entityType: "EVENT",
              entityId: newValue.id,
              oldValue,
              newValue,
            });
          },
          notificationWriter: () => notificationWriter(tx),
        };
        return run(store);
      });
    },
    bulkTransaction(run) {
      return db.transaction(async (tx) => {
        const store: BulkEventTransaction = {
          async roomAccessForBulk(roomId, userId) {
            const [room] = await tx
              .select({ id: rooms.id, status: rooms.status })
              .from(rooms)
              .where(eq(rooms.id, roomId))
              .limit(1)
              .for("update");
            if (!room) return null;
            const [member] = await tx
              .select({ status: roomMembers.status })
              .from(roomMembers)
              .where(
                and(
                  eq(roomMembers.roomId, room.id),
                  eq(roomMembers.userId, userId),
                ),
              )
              .limit(1)
              .for("share");
            return {
              active: room.status === "ACTIVE",
              memberActive: member?.status === "ACTIVE",
            };
          },
          async status(statusId) {
            const [row] = await tx
              .select({
                roomId: statusMaster.roomId,
                active: statusMaster.active,
              })
              .from(statusMaster)
              .where(eq(statusMaster.id, statusId))
              .limit(1)
              .for("share");
            return row ?? null;
          },
          async location(locationId) {
            const [row] = await tx
              .select({
                roomId: locationMaster.roomId,
                active: locationMaster.active,
              })
              .from(locationMaster)
              .where(eq(locationMaster.id, locationId))
              .limit(1)
              .for("share");
            return row ?? null;
          },
          async duplicateCandidates(roomId, ownerUserId, dates) {
            return tx
              .select()
              .from(events)
              .where(
                and(
                  eq(events.roomId, roomId),
                  eq(events.ownerUserId, ownerUserId),
                  inArray(events.startDate, dates),
                  eq(events.endDate, events.startDate),
                  isNull(events.deletedAt),
                ),
              );
          },
          async insertMany(inputs) {
            return tx.insert(events).values(inputs).returning();
          },
          async auditCreates(created) {
            await tx.insert(auditLog).values(
              created.map((event) => ({
                userId: event.ownerUserId,
                roomId: event.roomId,
                action: "CREATE_EVENT",
                entityType: "EVENT",
                entityId: event.id,
                oldValue: null,
                newValue: event,
              })),
            );
          },
          notificationWriter: () => notificationWriter(tx),
        };
        return run(store);
      });
    },
  };
}

export function getEventRepository(): EventRepository & BulkEventRepository {
  return createEventRepository(getDatabase().db);
}
