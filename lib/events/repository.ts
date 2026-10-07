import { and, eq, isNull } from "drizzle-orm";
import { createDatabase, getDatabase } from "../db";
import {
  auditLog,
  events,
  locationMaster,
  roomMembers,
  rooms,
  statusMaster,
} from "../db/schema";
import type {
  EventRepository,
  EventTransaction,
} from "../../services/event.service";

type Database = ReturnType<typeof createDatabase>["db"];

export function createEventRepository(db: Database): EventRepository {
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
        };
        return run(store);
      });
    },
  };
}

export function getEventRepository(): EventRepository {
  return createEventRepository(getDatabase().db);
}
