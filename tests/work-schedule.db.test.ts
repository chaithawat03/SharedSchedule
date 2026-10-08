import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../lib/db";
import {
  auditLog,
  roomMembers,
  rooms,
  users,
  workOverrides,
  workPatterns,
} from "../lib/db/schema";
import { createCalendarRepository } from "../lib/calendar/repository";
import { createWorkScheduleRepository } from "../lib/work-schedule/repository";
import { getCalendarMonth } from "../services/calendar.service";
import {
  createWorkOverride,
  deleteWorkOverride,
  putWorkPattern,
  type WorkScheduleRepository,
} from "../services/work-schedule.service";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;

suite("work calendar PostgreSQL integration", () => {
  const userId = randomUUID();
  const roomIds = [randomUUID(), randomUUID()];
  let database: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    if (!new URL(testDatabaseUrl!).pathname.toLowerCase().includes("test"))
      throw new Error(
        "TEST_DATABASE_URL must identify a dedicated test database",
      );
    database = createDatabase(testDatabaseUrl);
    await migrate(database.db, { migrationsFolder: resolve("drizzle") });
    await database.db.insert(users).values({
      id: userId,
      phoneNormalized: `+668${String(Date.now()).slice(-8)}`,
      displayName: "Global worker",
    });
    await database.db
      .insert(rooms)
      .values(
        roomIds.map((id) => ({ id, name: "Work room", ownerUserId: userId })),
      );
    await database.db
      .insert(roomMembers)
      .values(roomIds.map((roomId) => ({ roomId, userId, status: "ACTIVE" })));
  });

  afterAll(async () => {
    if (!database) return;
    await database.db.delete(auditLog).where(eq(auditLog.userId, userId));
    for (const roomId of roomIds)
      await database.db.delete(rooms).where(eq(rooms.id, roomId));
    await database.db.delete(users).where(eq(users.id, userId));
    await database.pool.end();
  });

  it("keeps one global Saturday override across two rooms and restores OFF after deletion", async () => {
    const repository = createWorkScheduleRepository(database.db);
    const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      state: weekday === 6 ? "OFF" : "NONE",
    }));
    await putWorkPattern(userId, { days }, repository);
    const created = await createWorkOverride(
      userId,
      {
        date: "2026-10-10",
        type: "WORK",
        startTime: "07:40",
        endTime: "17:00",
        note: "Factory working Saturday",
      },
      repository,
    );
    for (const roomId of roomIds) {
      const month = await getCalendarMonth(
        { id: userId, displayName: "Global worker" },
        roomId,
        2026,
        10,
        createCalendarRepository(database.db),
      );
      expect(month.days["2026-10-10"].users[userId].baseSchedule).toMatchObject(
        { code: "WORK", source: "OVERRIDE", startTime: "07:40" },
      );
      expect(month.days["2026-10-17"].users[userId].baseSchedule).toMatchObject(
        { code: "OFF", source: "PATTERN" },
      );
    }
    await deleteWorkOverride(userId, created.id, repository);
    const month = await getCalendarMonth(
      { id: userId, displayName: "Global worker" },
      roomIds[0],
      2026,
      10,
      createCalendarRepository(database.db),
    );
    expect(month.days["2026-10-10"].users[userId].baseSchedule).toMatchObject({
      code: "OFF",
      source: "PATTERN",
    });
    expect(
      await database.db
        .select()
        .from(workOverrides)
        .where(eq(workOverrides.userId, userId)),
    ).toHaveLength(0);
    expect(
      await database.db
        .select()
        .from(workPatterns)
        .where(
          and(eq(workPatterns.userId, userId), eq(workPatterns.weekday, 6)),
        ),
    ).toHaveLength(1);
    const audits = await database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId));
    expect(audits.map((audit) => audit.action).sort()).toEqual([
      "CREATE_WORK_OVERRIDE",
      "CREATE_WORK_PATTERN",
      "DELETE_WORK_OVERRIDE",
    ]);
    expect(audits.every((audit) => audit.roomId === null)).toBe(true);
  });

  it("maps a database uniqueness race to the same duplicate response without an extra audit", async () => {
    const repository = createWorkScheduleRepository(database.db);
    const first = await createWorkOverride(
      userId,
      { date: "2026-10-24", type: "OFF" },
      repository,
    );
    const auditsBeforeRace = await database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId));
    const raceRepository: WorkScheduleRepository = {
      ...repository,
      transaction: (owner, run) =>
        repository.transaction(owner, (tx) =>
          run({
            ...tx,
            overrideForDate: async () => null,
          }),
        ),
    };
    await expect(
      createWorkOverride(
        userId,
        { date: "2026-10-24", type: "OFF" },
        raceRepository,
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE" });
    expect(
      await database.db
        .select()
        .from(workOverrides)
        .where(
          and(
            eq(workOverrides.userId, userId),
            eq(workOverrides.date, "2026-10-24"),
          ),
        ),
    ).toHaveLength(1);
    const auditsAfterRace = await database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId));
    expect(auditsAfterRace).toHaveLength(auditsBeforeRace.length);
    expect(
      auditsAfterRace.filter((row) => row.entityId === first.id),
    ).toHaveLength(1);
    await deleteWorkOverride(userId, first.id, repository);
  });

  it("rolls back a weekly pattern change when its audit fails", async () => {
    const base = createWorkScheduleRepository(database.db);
    const before = await database.db
      .select()
      .from(workPatterns)
      .where(eq(workPatterns.userId, userId));
    const auditsBefore = await database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId));
    const failing: WorkScheduleRepository = {
      ...base,
      transaction: (owner, run) =>
        base.transaction(owner, (tx) =>
          run({
            ...tx,
            audit: async () => {
              throw new Error("audit failed");
            },
          }),
        ),
    };
    await expect(
      putWorkPattern(
        userId,
        {
          days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
            weekday,
            state: weekday === 7 ? ("WORK" as const) : ("NONE" as const),
            ...(weekday === 7 ? { startTime: "09:00", endTime: "17:00" } : {}),
          })),
        },
        failing,
      ),
    ).rejects.toThrow("audit failed");
    expect(
      await database.db
        .select()
        .from(workPatterns)
        .where(eq(workPatterns.userId, userId)),
    ).toEqual(before);
    expect(
      await database.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.userId, userId)),
    ).toEqual(auditsBefore);
  });

  it("rolls back an override creation when its audit fails", async () => {
    const base = createWorkScheduleRepository(database.db);
    const auditsBefore = await database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId));
    const failing: WorkScheduleRepository = {
      ...base,
      transaction: (owner, run) =>
        base.transaction(owner, (tx) =>
          run({
            ...tx,
            audit: async () => {
              throw new Error("audit failed");
            },
          }),
        ),
    };
    await expect(
      createWorkOverride(userId, { date: "2026-11-09", type: "OFF" }, failing),
    ).rejects.toThrow("audit failed");
    expect(
      await database.db
        .select()
        .from(workOverrides)
        .where(
          and(
            eq(workOverrides.userId, userId),
            eq(workOverrides.date, "2026-11-09"),
          ),
        ),
    ).toHaveLength(0);
    expect(
      await database.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.userId, userId)),
    ).toEqual(auditsBefore);
  });
});
