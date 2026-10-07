import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../lib/db";
import { createCalendarRepository } from "../lib/calendar/repository";
import { auditLog, events, roomMembers, rooms, users } from "../lib/db/schema";
import { createMasterRepository } from "../lib/master-data/repository";
import { createRoomRepository } from "../lib/rooms/repository";
import { createRoom } from "../services/room.service";
import { getCalendarMonth } from "../services/calendar.service";
import {
  createLocation,
  createStatus,
  deleteLocation,
  listLocations,
  listStatuses,
  patchLocation,
  patchStatus,
  putStatusOrder,
  type MasterRepository,
} from "../services/master-data.service";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;

suite("room masters PostgreSQL integration", () => {
  let database: ReturnType<typeof createDatabase>;
  let userId: string;
  let memberId: string;
  let roomId: string;
  let ownerWithoutMembershipStatusId: string;
  let repo: MasterRepository;
  const phone = `08${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;

  beforeAll(async () => {
    if (!new URL(testDatabaseUrl!).pathname.toLowerCase().includes("test"))
      throw new Error(
        "TEST_DATABASE_URL must point to a dedicated database with 'test' in its name",
      );
    database = createDatabase(testDatabaseUrl);
    await migrate(database.db, { migrationsFolder: resolve("drizzle") });
    const [user] = await database.db
      .insert(users)
      .values({
        phoneNormalized: `+66${phone.slice(1)}`,
        displayName: "Master owner",
      })
      .returning({ id: users.id });
    userId = user.id;
    const secondPhone = `09${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;
    const [member] = await database.db
      .insert(users)
      .values({
        phoneNormalized: `+66${secondPhone.slice(1)}`,
        displayName: "Forged role",
      })
      .returning({ id: users.id });
    memberId = member.id;
    const room = await createRoom(
      userId,
      { name: "Master room" },
      createRoomRepository(database.db),
    );
    roomId = room.id;
    repo = createMasterRepository(database.db);
    ownerWithoutMembershipStatusId = (
      await createStatus(
        userId,
        roomId,
        { code: "BEFORE_JOIN", name: "Before Join" },
        repo,
      )
    ).id;
    await database.db.insert(roomMembers).values([
      { roomId, userId, role: "MEMBER" },
      { roomId, userId: memberId, role: "OWNER" },
    ]);
  });

  afterAll(async () => {
    if (!database) return;
    if (roomId) {
      await database.db.delete(auditLog).where(eq(auditLog.roomId, roomId));
      await database.db.delete(events).where(eq(events.roomId, roomId));
      await database.db.delete(rooms).where(eq(rooms.id, roomId));
    }
    if (memberId) await database.db.delete(users).where(eq(users.id, memberId));
    if (userId) await database.db.delete(users).where(eq(users.id, userId));
    await database.pool.end();
  });

  it("lets the owner with MEMBER role manage while forged OWNER role only reads active choices", async () => {
    expect(
      (await listStatuses(userId, roomId, false, repo)).some(
        (row) => row.id === ownerWithoutMembershipStatusId,
      ),
    ).toBe(true);
    expect(
      (await listStatuses(memberId, roomId, false, repo)).length,
    ).toBeGreaterThan(0);
    await expect(
      listStatuses(memberId, roomId, true, repo),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createStatus(memberId, roomId, { code: "FORGED", name: "Forged" }, repo),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (
        await createStatus(
          userId,
          roomId,
          { code: "OWNER_TEST", name: "Owner Test" },
          repo,
        )
      ).code,
    ).toBe("OWNER_TEST");
  });

  it("serializes case-insensitive duplicate creates and renames by locking the room", async () => {
    const attempts = await Promise.allSettled([
      createStatus(
        userId,
        roomId,
        { code: "TRAINING", name: "Training" },
        repo,
      ),
      createStatus(
        userId,
        roomId,
        { code: "TRAINING_2", name: " training " },
        repo,
      ),
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(attempts.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
    const first = await createLocation(
      userId,
      roomId,
      { name: "Branch A" },
      repo,
    );
    const second = await createLocation(
      userId,
      roomId,
      { name: "Branch B" },
      repo,
    );
    const renames = await Promise.allSettled([
      patchLocation(userId, roomId, first.id, { name: "Main Office" }, repo),
      patchLocation(userId, roomId, second.id, { name: " main office " }, repo),
    ]);
    expect(renames.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(renames.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
  });

  it("keeps referenced events readable after deactivation and rename without changing event rows", async () => {
    const statuses = await listStatuses(userId, roomId, false, repo);
    const work = statuses.find((row) => row.code === "WORK")!;
    const location = await createLocation(
      userId,
      roomId,
      { name: "Factory" },
      repo,
    );
    const [event] = await database.db
      .insert(events)
      .values({
        roomId,
        ownerUserId: userId,
        createdBy: userId,
        statusId: work.id,
        startDate: "2026-10-07",
        endDate: "2026-10-07",
        allDay: true,
        locationId: location.id,
      })
      .returning();
    await patchStatus(
      userId,
      roomId,
      work.id,
      { active: false, name: "Factory Shift" },
      repo,
    );
    await deleteLocation(userId, roomId, location.id, repo);
    await patchLocation(
      userId,
      roomId,
      location.id,
      { name: "Old Factory" },
      repo,
    );
    const [persisted] = await database.db
      .select()
      .from(events)
      .where(eq(events.id, event.id));
    expect(persisted.statusId).toBe(work.id);
    expect(persisted.locationId).toBe(location.id);
    expect(persisted.deletedAt).toBeNull();
    expect(
      (await listStatuses(userId, roomId, true, repo)).find(
        (row) => row.id === work.id,
      ),
    ).toMatchObject({ name: "Factory Shift", active: false });
    expect(
      (await listLocations(userId, roomId, true, repo)).find(
        (row) => row.id === location.id,
      ),
    ).toMatchObject({ name: "Old Factory", active: false });
    expect(
      (await listStatuses(userId, roomId, false, repo)).some(
        (row) => row.id === work.id,
      ),
    ).toBe(false);
    expect(
      (await listLocations(userId, roomId, false, repo)).some(
        (row) => row.id === location.id,
      ),
    ).toBe(false);
    const calendar = await getCalendarMonth(
      { id: userId, displayName: "Master owner" },
      roomId,
      2026,
      10,
      createCalendarRepository(database.db),
    );
    expect(calendar.days["2026-10-07"].users[userId].events).toEqual([
      expect.objectContaining({
        eventId: event.id,
        statusName: "Factory Shift",
        locationName: "Old Factory",
      }),
    ]);
    expect(calendar.statuses.some((row) => row.id === work.id)).toBe(false);
    expect(calendar.locations.some((row) => row.id === location.id)).toBe(
      false,
    );
    const eventAudits = await database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, event.id));
    expect(eventAudits).toHaveLength(0);
  });

  it("rolls back reorder updates if its single audit fails", async () => {
    const before = await listStatuses(userId, roomId, false, repo);
    const ids = before.map((row) => row.id).reverse();
    const failing: MasterRepository = {
      ...repo,
      transaction: (run) =>
        repo.transaction((tx) =>
          run({
            ...tx,
            async audit(row) {
              if (row.action === "REORDER_STATUSES")
                throw new Error("audit failed");
              await tx.audit(row);
            },
          }),
        ),
    };
    await expect(
      putStatusOrder(userId, roomId, { ids }, failing),
    ).rejects.toThrow("audit failed");
    expect(
      (await listStatuses(userId, roomId, false, repo)).map((row) => [
        row.id,
        row.sortOrder,
      ]),
    ).toEqual(before.map((row) => [row.id, row.sortOrder]));
  });

  it("preserves the last active status transactionally", async () => {
    const active = await listStatuses(userId, roomId, false, repo);
    for (const row of active.slice(0, -1))
      await patchStatus(userId, roomId, row.id, { active: false }, repo);
    const last = active.at(-1)!;
    await expect(
      patchStatus(userId, roomId, last.id, { active: false }, repo),
    ).rejects.toMatchObject({ code: "LAST_ACTIVE_STATUS" });
    expect(
      (await listStatuses(userId, roomId, false, repo)).map((row) => row.id),
    ).toEqual([last.id]);
  });
});
