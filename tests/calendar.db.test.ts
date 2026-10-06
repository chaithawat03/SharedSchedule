import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase } from "../lib/db";
import {
  events,
  locationMaster,
  roomMembers,
  rooms,
  statusMaster,
  users,
  workPatterns,
} from "../lib/db/schema";
import { createCalendarRepository } from "../lib/calendar/repository";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;

suite("calendar PostgreSQL integration", () => {
  let database: ReturnType<typeof createDatabase>;
  const userIds = [randomUUID(), randomUUID(), randomUUID()];
  const roomId = randomUUID();
  const foreignRoomId = randomUUID();
  const workStatusId = randomUUID();
  const foreignStatusId = randomUUID();
  const locationId = randomUUID();
  const foreignLocationId = randomUUID();
  const eventIds = Array.from({ length: 5 }, () => randomUUID());

  beforeAll(async () => {
    if (!new URL(testDatabaseUrl!).pathname.toLowerCase().includes("test")) {
      throw new Error(
        "TEST_DATABASE_URL must point to a dedicated database with 'test' in its name",
      );
    }
    database = createDatabase(testDatabaseUrl);
    await migrate(database.db, { migrationsFolder: resolve("drizzle") });
    await database.db.insert(users).values(
      userIds.map((id, index) => ({
        id,
        phoneNormalized: `+668${String(Date.now() + index).slice(-8)}`,
        displayName: `Calendar ${index}`,
      })),
    );
    await database.db.insert(rooms).values([
      { id: roomId, name: "Calendar room", ownerUserId: userIds[0] },
      { id: foreignRoomId, name: "Foreign room", ownerUserId: userIds[2] },
    ]);
    await database.db.insert(roomMembers).values([
      { roomId, userId: userIds[0], status: "ACTIVE" },
      { roomId, userId: userIds[1], status: "ACTIVE" },
      { roomId, userId: userIds[2], status: "INACTIVE" },
    ]);
    await database.db.insert(statusMaster).values([
      { id: workStatusId, roomId, code: "WORK", name: "Work" },
      {
        id: foreignStatusId,
        roomId: foreignRoomId,
        code: "SECRET",
        name: "Secret",
      },
    ]);
    await database.db.insert(locationMaster).values([
      { id: locationId, roomId, name: "MCP" },
      { id: foreignLocationId, roomId: foreignRoomId, name: "Secret location" },
    ]);
    await database.db.insert(workPatterns).values({
      userId: userIds[0],
      weekday: 1,
      working: true,
      startTime: "07:40",
      endTime: "17:00",
    });
    await database.db.insert(events).values([
      {
        id: eventIds[0],
        roomId,
        ownerUserId: userIds[0],
        createdBy: userIds[0],
        statusId: workStatusId,
        startDate: "2026-09-29",
        endDate: "2026-10-02",
        allDay: true,
      },
      {
        id: eventIds[1],
        roomId,
        ownerUserId: userIds[1],
        createdBy: userIds[1],
        statusId: foreignStatusId,
        locationId: foreignLocationId,
        startDate: "2026-10-12",
        endDate: "2026-10-12",
        allDay: true,
      },
      {
        id: eventIds[2],
        roomId,
        ownerUserId: userIds[2],
        createdBy: userIds[2],
        statusId: workStatusId,
        startDate: "2026-10-12",
        endDate: "2026-10-12",
      },
      {
        id: eventIds[3],
        roomId,
        ownerUserId: userIds[0],
        createdBy: userIds[0],
        statusId: workStatusId,
        startDate: "2026-10-12",
        endDate: "2026-10-12",
        deletedAt: new Date(),
      },
      {
        id: eventIds[4],
        roomId,
        ownerUserId: userIds[0],
        createdBy: userIds[0],
        statusId: workStatusId,
        startDate: "2026-11-01",
        endDate: "2026-11-02",
      },
    ]);
  });

  afterAll(async () => {
    if (!database) return;
    await database.db.delete(rooms).where(eq(rooms.id, roomId));
    await database.db.delete(rooms).where(eq(rooms.id, foreignRoomId));
    for (const id of userIds)
      await database.db.delete(users).where(eq(users.id, id));
    await database.pool.end();
  });

  it("loads only active participants and overlapping nondeleted events using bounded queries", async () => {
    const repository = createCalendarRepository(database.db);
    const querySpy = vi.spyOn(database.pool, "query");
    try {
      const access = await repository.getRoom(roomId);
      expect(access?.members.map((member) => member.userId).sort()).toEqual(
        userIds.slice(0, 2).sort(),
      );
      const rows = await repository.loadMonth(
        roomId,
        access!.members.map((member) => member.userId),
        "2026-10-01",
        "2026-10-31",
      );
      expect(rows.events.map((event) => event.id).sort()).toEqual(
        eventIds.slice(0, 2).sort(),
      );
      expect(rows.statuses.map((status) => status.id)).toEqual([workStatusId]);
      expect(rows.locations.map((location) => location.id)).toEqual([
        locationId,
      ]);
      expect(rows.patterns).toHaveLength(1);
      expect(querySpy.mock.calls.length).toBeGreaterThan(0);
      expect(querySpy.mock.calls.length).toBeLessThanOrEqual(7);
    } finally {
      querySpy.mockRestore();
    }
  });
});
