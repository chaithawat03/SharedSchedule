import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../lib/db";
import {
  auditLog,
  events,
  locationMaster,
  roomMembers,
  rooms,
  statusMaster,
  users,
} from "../lib/db/schema";
import { createCalendarRepository } from "../lib/calendar/repository";
import { createEventRepository } from "../lib/events/repository";
import { createRoomRepository } from "../lib/rooms/repository";
import { getCalendarMonth } from "../services/calendar.service";
import {
  createEvent,
  deleteEvent,
  updateEvent,
} from "../services/event.service";
import { createRoom } from "../services/room.service";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("event PostgreSQL integration", () => {
  let database: ReturnType<typeof createDatabase>;
  const userId = randomUUID();
  const secondUserId = randomUUID();
  const roomIds: string[] = [];
  let roomId: string;
  let otherRoomId: string;
  let statusId: string;
  let foreignStatusId: string;
  let locationId: string;
  let foreignLocationId: string;

  beforeAll(async () => {
    if (!new URL(url!).pathname.toLowerCase().includes("test"))
      throw new Error("TEST_DATABASE_URL must name a dedicated test database");
    database = createDatabase(url);
    await migrate(database.db, { migrationsFolder: resolve("drizzle") });
    await database.db.insert(users).values([
      {
        id: userId,
        phoneNormalized: `+668${String(Date.now()).slice(-8)}`,
        displayName: "Event owner",
      },
      {
        id: secondUserId,
        phoneNormalized: `+669${String(Date.now()).slice(-8)}`,
        displayName: "Other member",
      },
    ]);
    const repo = createRoomRepository(database.db);
    roomId = (await createRoom(userId, { name: "Event room" }, repo)).id;
    otherRoomId = (
      await createRoom(secondUserId, { name: "Foreign room" }, repo)
    ).id;
    roomIds.push(roomId, otherRoomId);
    await database.db.insert(roomMembers).values([
      { roomId, userId, status: "ACTIVE" },
      { roomId, userId: secondUserId, status: "ACTIVE" },
    ]);
    statusId = (
      await database.db
        .select()
        .from(statusMaster)
        .where(eq(statusMaster.roomId, roomId))
    ).find((row) => row.code === "OT")!.id;
    foreignStatusId = (
      await database.db
        .select()
        .from(statusMaster)
        .where(eq(statusMaster.roomId, otherRoomId))
    ).find((row) => row.code === "OT")!.id;
    [locationId] = [randomUUID()];
    [foreignLocationId] = [randomUUID()];
    await database.db.insert(locationMaster).values([
      { id: locationId, roomId, name: "MCP" },
      { id: foreignLocationId, roomId: otherRoomId, name: "Other" },
    ]);
  });

  afterAll(async () => {
    if (!database) return;
    for (const id of roomIds) {
      await database.db.delete(auditLog).where(eq(auditLog.roomId, id));
      await database.db.delete(rooms).where(eq(rooms.id, id));
    }
    await database.db.delete(users).where(eq(users.id, userId));
    await database.db.delete(users).where(eq(users.id, secondUserId));
    await database.pool.end();
  });

  it("persists create, partial update, no-op, soft delete, and matching audit history", async () => {
    const repository = createEventRepository(database.db);
    const created = await createEvent(
      userId,
      roomId,
      {
        statusId,
        startDate: "2026-10-12",
        endDate: "2026-10-12",
        allDay: false,
        startTime: "17:20",
        endTime: "19:40",
        endTimeOpen: true,
        locationId,
      },
      repository,
    );
    expect(created.ownerUserId).toBe(userId);
    const updated = await updateEvent(
      userId,
      created.id,
      { title: "Overtime" },
      repository,
    );
    expect(updated.title).toBe("Overtime");
    await updateEvent(userId, created.id, { title: " Overtime " }, repository);
    const historyBeforeDelete = await database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, created.id));
    expect(historyBeforeDelete.map((item) => item.action)).toEqual([
      "CREATE_EVENT",
      "UPDATE_EVENT",
    ]);
    expect(historyBeforeDelete[1].oldValue).toMatchObject({ title: null });
    expect(historyBeforeDelete[1].newValue).toMatchObject({
      title: "Overtime",
    });
    const month = await getCalendarMonth(
      { id: userId, displayName: "Event owner" },
      roomId,
      2026,
      10,
      createCalendarRepository(database.db),
    );
    expect(
      month.days["2026-10-12"].users[userId].events.map(
        (event) => event.eventId,
      ),
    ).toContain(created.id);
    const deleted = await deleteEvent(userId, created.id, repository);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    const stored = (
      await database.db.select().from(events).where(eq(events.id, created.id))
    )[0];
    expect(stored.deletedAt).toEqual(deleted.deletedAt);
    const history = await database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, created.id));
    expect(history.map((item) => item.action)).toEqual([
      "CREATE_EVENT",
      "UPDATE_EVENT",
      "DELETE_EVENT",
    ]);
    expect(history[2].newValue).toMatchObject({
      deletedAt: deleted.deletedAt?.toISOString(),
    });
    const after = await getCalendarMonth(
      { id: userId, displayName: "Event owner" },
      roomId,
      2026,
      10,
      createCalendarRepository(database.db),
    );
    expect(
      after.days["2026-10-12"].users[userId].events.map(
        (event) => event.eventId,
      ),
    ).not.toContain(created.id);
  });

  it("rejects cross-room references and other member updates before any write or audit", async () => {
    const repository = createEventRepository(database.db);
    const input = {
      statusId,
      startDate: "2026-10-13",
      endDate: "2026-10-13",
      allDay: true,
    };
    await expect(
      createEvent(
        userId,
        roomId,
        { ...input, statusId: foreignStatusId },
        repository,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      createEvent(
        userId,
        roomId,
        { ...input, locationId: foreignLocationId },
        repository,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const event = await createEvent(userId, roomId, input, repository);
    await expect(
      updateEvent(secondUserId, event.id, { title: "No" }, repository),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (
        await database.db
          .select()
          .from(auditLog)
          .where(eq(auditLog.entityId, event.id))
      ).map((item) => item.action),
    ).toEqual(["CREATE_EVENT"]);
  });

  it("rolls back an event insert if its transaction fails before audit", async () => {
    const repository = createEventRepository(database.db);
    const marker = "rollback marker";
    await expect(
      repository.transaction(async (tx) => {
        await tx.insert({
          roomId,
          ownerUserId: userId,
          createdBy: userId,
          statusId,
          title: marker,
          startDate: "2026-10-14",
          endDate: "2026-10-14",
          allDay: true,
          startTime: null,
          endTime: null,
          endTimeOpen: false,
          locationId: null,
          locationText: null,
          note: null,
        });
        throw new Error("audit failed");
      }),
    ).rejects.toThrow("audit failed");
    expect(
      await database.db.select().from(events).where(eq(events.title, marker)),
    ).toHaveLength(0);
  });
});
