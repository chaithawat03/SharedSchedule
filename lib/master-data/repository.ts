import { and, eq } from "drizzle-orm";
import { createDatabase, getDatabase } from "../db";
import {
  auditLog,
  locationMaster,
  roomMembers,
  rooms,
  statusMaster,
} from "../db/schema";
import {
  MasterError,
  type MasterRepository,
  type MasterRoomAccess,
  type MasterTransaction,
} from "../../services/master-data.service";

type Database = ReturnType<typeof createDatabase>["db"];

function duplicateConstraint(error: unknown): boolean {
  let cause = error;
  for (
    let depth = 0;
    depth < 4 && cause && typeof cause === "object";
    depth++
  ) {
    const value = cause as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (
      value.code === "23505" &&
      [
        "status_master_room_code_unique",
        "location_master_room_name_unique",
      ].includes(value.constraint ?? "")
    )
      return true;
    cause = value.cause;
  }
  return false;
}

export function createMasterRepository(db: Database): MasterRepository {
  return {
    async readAccess(roomId, userId) {
      const [room] = await db
        .select({
          id: rooms.id,
          ownerUserId: rooms.ownerUserId,
          status: rooms.status,
        })
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);
      if (!room) return null;
      const [member] = await db
        .select({ status: roomMembers.status })
        .from(roomMembers)
        .where(
          and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)),
        )
        .limit(1);
      return { ...room, memberActive: member?.status === "ACTIVE" };
    },
    readStatuses(roomId) {
      return db
        .select()
        .from(statusMaster)
        .where(eq(statusMaster.roomId, roomId));
    },
    readLocations(roomId) {
      return db
        .select()
        .from(locationMaster)
        .where(eq(locationMaster.roomId, roomId));
    },
    async transaction(run) {
      try {
        return await db.transaction(async (tx) => {
          let lockedRoom: string | null = null;
          const scopedRoom = () => {
            if (!lockedRoom) throw new Error("Room must be locked first");
            return lockedRoom;
          };
          const store: MasterTransaction = {
            async lockRoom(roomId, userId): Promise<MasterRoomAccess | null> {
              const [room] = await tx
                .select({
                  id: rooms.id,
                  ownerUserId: rooms.ownerUserId,
                  status: rooms.status,
                })
                .from(rooms)
                .where(eq(rooms.id, roomId))
                .limit(1)
                .for("update");
              if (!room) return null;
              lockedRoom = room.id;
              const [member] = await tx
                .select({ status: roomMembers.status })
                .from(roomMembers)
                .where(
                  and(
                    eq(roomMembers.roomId, roomId),
                    eq(roomMembers.userId, userId),
                  ),
                )
                .limit(1);
              return { ...room, memberActive: member?.status === "ACTIVE" };
            },
            statuses() {
              return tx
                .select()
                .from(statusMaster)
                .where(eq(statusMaster.roomId, scopedRoom()));
            },
            locations() {
              return tx
                .select()
                .from(locationMaster)
                .where(eq(locationMaster.roomId, scopedRoom()));
            },
            async status(id) {
              const [row] = await tx
                .select()
                .from(statusMaster)
                .where(
                  and(
                    eq(statusMaster.roomId, scopedRoom()),
                    eq(statusMaster.id, id),
                  ),
                )
                .limit(1)
                .for("update");
              return row ?? null;
            },
            async location(id) {
              const [row] = await tx
                .select()
                .from(locationMaster)
                .where(
                  and(
                    eq(locationMaster.roomId, scopedRoom()),
                    eq(locationMaster.id, id),
                  ),
                )
                .limit(1)
                .for("update");
              return row ?? null;
            },
            async insertStatus(values) {
              const [row] = await tx
                .insert(statusMaster)
                .values({ ...values, roomId: scopedRoom() })
                .returning();
              return row;
            },
            async updateStatus(id, values) {
              const [row] = await tx
                .update(statusMaster)
                .set(values)
                .where(
                  and(
                    eq(statusMaster.roomId, scopedRoom()),
                    eq(statusMaster.id, id),
                  ),
                )
                .returning();
              if (!row) throw new MasterError("NOT_FOUND", "Master not found");
              return row;
            },
            async insertLocation(values) {
              const [row] = await tx
                .insert(locationMaster)
                .values({ ...values, roomId: scopedRoom() })
                .returning();
              return row;
            },
            async updateLocation(id, values) {
              const [row] = await tx
                .update(locationMaster)
                .set(values)
                .where(
                  and(
                    eq(locationMaster.roomId, scopedRoom()),
                    eq(locationMaster.id, id),
                  ),
                )
                .returning();
              if (!row) throw new MasterError("NOT_FOUND", "Master not found");
              return row;
            },
            async audit(row) {
              await tx.insert(auditLog).values(row);
            },
          };
          return run(store);
        });
      } catch (error) {
        if (duplicateConstraint(error))
          throw new MasterError(
            "DUPLICATE",
            "A status code or master name is already used in this room",
          );
        throw error;
      }
    },
  };
}

export function getMasterRepository(): MasterRepository {
  return createMasterRepository(getDatabase().db);
}
