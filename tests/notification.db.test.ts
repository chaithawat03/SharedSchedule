import { randomInt, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../lib/db";
import {
  auditLog,
  events,
  notifications,
  roomMembers,
  rooms,
  statusMaster,
  users,
} from "../lib/db/schema";
import { createEventRepository } from "../lib/events/repository";
import { createNotificationRepository } from "../lib/notifications/repository";
import { createRoomRepository } from "../lib/rooms/repository";
import {
  createBulkEvents,
  type BulkEventTransaction,
} from "../services/bulk-event.service";
import {
  createEvent,
  deleteEvent,
  updateEvent,
  type EventRepository,
} from "../services/event.service";
import {
  listNotifications,
  markNotificationRead,
} from "../services/notification.service";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;

suite("notification PostgreSQL integration", () => {
  const [owner, actor, member, outsider] = Array.from({ length: 4 }, () =>
    randomUUID(),
  );
  let database: ReturnType<typeof createDatabase>;
  let roomId: string;
  let otherRoomId: string;
  let statusId: string;

  beforeAll(async () => {
    if (!new URL(testDatabaseUrl!).pathname.toLowerCase().includes("test"))
      throw new Error(
        "TEST_DATABASE_URL must identify a dedicated test database",
      );
    database = createDatabase(testDatabaseUrl);
    await migrate(database.db, { migrationsFolder: resolve("drizzle") });
    await database.db.insert(users).values(
      [owner, actor, member, outsider].map((id, index) => ({
        id,
        phoneNormalized: `+668${String(randomInt(0, 100_000_000)).padStart(8, "0")}`,
        displayName: `User ${index}`,
      })),
    );
    roomId = (
      await createRoomRepository(database.db).createRoom({
        ownerUserId: owner,
        name: "Notification room",
        description: null,
      })
    ).id;
    otherRoomId = (
      await createRoomRepository(database.db).createRoom({
        ownerUserId: outsider,
        name: "Other room",
        description: null,
      })
    ).id;
    await database.db.insert(roomMembers).values([
      { roomId, userId: actor, status: "ACTIVE" },
      { roomId, userId: member, status: "ACTIVE" },
    ]);
    [statusId] = (
      await database.db
        .select({ id: statusMaster.id })
        .from(statusMaster)
        .where(
          and(eq(statusMaster.roomId, roomId), eq(statusMaster.code, "OFF")),
        )
    ).map((row) => row.id);
  });

  afterAll(async () => {
    if (!database) return;
    await database.db.delete(auditLog).where(eq(auditLog.roomId, roomId));
    await database.db.delete(auditLog).where(eq(auditLog.roomId, otherRoomId));
    await database.db
      .delete(notifications)
      .where(eq(notifications.roomId, roomId));
    await database.db
      .delete(notifications)
      .where(eq(notifications.roomId, otherRoomId));
    await database.db.delete(events).where(eq(events.roomId, roomId));
    await database.db.delete(rooms).where(eq(rooms.id, roomId));
    await database.db.delete(rooms).where(eq(rooms.id, otherRoomId));
    for (const id of [owner, actor, member, outsider])
      await database.db.delete(users).where(eq(users.id, id));
    await database.pool.end();
  });

  it("writes event and audit with two recipient records, then one bulk summary each", async () => {
    const repo = createEventRepository(database.db);
    const created = await createEvent(
      actor,
      roomId,
      {
        statusId,
        startDate: "2026-10-08",
        endDate: "2026-10-08",
        allDay: true,
        title: "Private title",
        note: "Private note",
      },
      repo,
    );
    const noticeRepo = createNotificationRepository(database.db);
    let rows = await database.db
      .select()
      .from(notifications)
      .where(eq(notifications.roomId, roomId));
    expect(rows.map((row) => row.toUserId).sort()).toEqual(
      [owner, member].sort(),
    );
    expect(
      rows.every(
        (row) =>
          row.eventId === created.id &&
          row.type === "EVENT_CREATED" &&
          !row.message.includes("Private"),
      ),
    ).toBe(true);
    expect(await noticeRepo.unreadCount(actor)).toBe(0);
    await updateEvent(actor, created.id, { title: " Private title " }, repo);
    expect(await noticeRepo.unreadCount(owner)).toBe(1);
    await updateEvent(actor, created.id, { title: "Changed" }, repo);
    await deleteEvent(actor, created.id, repo);
    await createBulkEvents(
      actor,
      roomId,
      {
        dates: ["2026-10-12", "2026-10-14"],
        event: { statusId, allDay: true },
      },
      repo,
    );
    rows = await database.db
      .select()
      .from(notifications)
      .where(eq(notifications.roomId, roomId));
    expect(rows.filter((row) => row.toUserId === owner)).toHaveLength(4);
    expect(
      rows.filter((row) => row.type === "BULK_EVENTS_CREATED"),
    ).toHaveLength(2);
    expect(
      rows
        .filter((row) => row.type === "BULK_EVENTS_CREATED")
        .every((row) => row.eventId === null),
    ).toBe(true);
    const audits = await database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, created.id));
    expect(audits.map((row) => row.action).sort()).toEqual([
      "CREATE_EVENT",
      "DELETE_EVENT",
      "UPDATE_EVENT",
    ]);
  });

  it("filters by current access and preserves read_at across repeated or concurrent marks", async () => {
    const repo = createNotificationRepository(database.db);
    const [target] = await database.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.roomId, roomId),
          eq(notifications.toUserId, member),
        ),
      )
      .limit(1);
    const first = await markNotificationRead(member, target.id, repo);
    const [second, third] = await Promise.all([
      markNotificationRead(member, target.id, repo),
      markNotificationRead(member, target.id, repo),
    ]);
    expect(second.readAt).toEqual(first.readAt);
    expect(third.readAt).toEqual(first.readAt);
    await database.db
      .update(roomMembers)
      .set({ status: "INACTIVE" })
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, member)),
      );
    expect(
      (await listNotifications(member, null, null, repo)).notifications,
    ).toHaveLength(0);
    expect(await repo.unreadCount(member)).toBe(0);
    await expect(
      markNotificationRead(member, target.id, repo),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await database.db
      .update(roomMembers)
      .set({ status: "ACTIVE" })
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, member)),
      );
    await database.db
      .update(rooms)
      .set({ status: "INACTIVE" })
      .where(eq(rooms.id, roomId));
    expect(
      (await listNotifications(owner, null, null, repo)).notifications,
    ).toHaveLength(0);
    await database.db
      .update(rooms)
      .set({ status: "ACTIVE" })
      .where(eq(rooms.id, roomId));
    const [hidden] = await database.db
      .insert(notifications)
      .values({
        roomId: otherRoomId,
        fromUserId: outsider,
        toUserId: owner,
        eventId: null,
        type: "EVENT_CREATED",
        message: "Hidden",
      })
      .returning({ id: notifications.id });
    expect(
      (await listNotifications(owner, null, null, repo)).notifications.every(
        (row) => row.roomId === roomId,
      ),
    ).toBe(true);
    await expect(
      markNotificationRead(owner, hidden.id, repo),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("paginates microseconds and equal timestamps by id without duplicates", async () => {
    const repo = createNotificationRepository(database.db);
    const tied = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const ids = Array.from({ length: 4 }, () => randomUUID());
    await database.db.insert(notifications).values(
      ids.map((id) => ({
        id,
        roomId,
        fromUserId: actor,
        toUserId: owner,
        eventId: null,
        type: "EVENT_CREATED",
        message: "A room member added an event.",
        createdAt: tied,
      })),
    );
    for (const [index, id] of ids.entries()) {
      const microseconds = index < 2 ? 2 : index === 2 ? 1 : 0;
      await database.db.execute(
        sql`update notifications set created_at = ${tied.toISOString()}::timestamptz + ${microseconds} * interval '1 microsecond' where id = ${id}::uuid`,
      );
    }
    const first = await listNotifications(owner, "2", null, repo);
    const second = await listNotifications(owner, "2", first.nextCursor, repo);
    expect(first.notifications.map((row) => row.id)).toEqual(
      ids.slice(0, 2).sort().reverse(),
    );
    expect(second.notifications.map((row) => row.id)).toEqual(ids.slice(2));
    expect(second.notifications[0].createdAt.endsWith("001Z")).toBe(true);
    expect(first.unreadCount).toBeGreaterThan(first.notifications.length);
  });

  it("rolls back an event and audit if notification insertion fails", async () => {
    const base = createEventRepository(database.db);
    const failing: EventRepository = {
      transaction: (run) =>
        base.transaction((tx) =>
          run({
            ...tx,
            notificationWriter: () => ({
              ...tx.notificationWriter(),
              insert: async () => {
                throw new Error("notification failed");
              },
            }),
          }),
        ),
    };
    await expect(
      createEvent(
        actor,
        roomId,
        {
          statusId,
          startDate: "2026-10-21",
          endDate: "2026-10-21",
          allDay: true,
          title: "Rollback notification",
        },
        failing,
      ),
    ).rejects.toThrow("notification failed");
    expect(
      await database.db
        .select()
        .from(events)
        .where(eq(events.title, "Rollback notification")),
    ).toHaveLength(0);
    const matchingAudits = (
      await database.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.roomId, roomId))
    ).filter(
      (row) =>
        (row.newValue as { title?: string } | null)?.title ===
        "Rollback notification",
    );
    expect(matchingAudits).toHaveLength(0);
    const bulkFailure = {
      ...base,
      bulkTransaction: <T>(run: (tx: BulkEventTransaction) => Promise<T>) =>
        base.bulkTransaction((tx) =>
          run({
            ...tx,
            notificationWriter: () => ({
              ...tx.notificationWriter(),
              insert: async () => {
                throw new Error("notification failed");
              },
            }),
          }),
        ),
    };
    await expect(
      createBulkEvents(
        actor,
        roomId,
        {
          dates: ["2026-10-22", "2026-10-23"],
          event: {
            statusId,
            allDay: true,
            title: "Rollback bulk notification",
          },
        },
        bulkFailure,
      ),
    ).rejects.toThrow("notification failed");
    expect(
      await database.db
        .select()
        .from(events)
        .where(eq(events.title, "Rollback bulk notification")),
    ).toHaveLength(0);
    const bulkAudits = (
      await database.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.roomId, roomId))
    ).filter(
      (row) =>
        (row.newValue as { title?: string } | null)?.title ===
        "Rollback bulk notification",
    );
    expect(bulkAudits).toHaveLength(0);
  });

  it("reveals only actors who currently belong to the notification room", async () => {
    const repo = createNotificationRepository(database.db);
    const [activeActorNotice, ownerActorNotice, otherRoomActorNotice] =
      await database.db
        .insert(notifications)
        .values([
          {
            roomId,
            fromUserId: actor,
            toUserId: owner,
            eventId: null,
            type: "EVENT_CREATED",
            message: "A room member added an event.",
          },
          {
            roomId,
            fromUserId: owner,
            toUserId: member,
            eventId: null,
            type: "EVENT_CREATED",
            message: "A room member added an event.",
          },
          {
            roomId,
            fromUserId: outsider,
            toUserId: owner,
            eventId: null,
            type: "EVENT_CREATED",
            message: "A room member added an event.",
          },
        ])
        .returning({ id: notifications.id });

    const ownerFeed = await listNotifications(owner, "50", null, repo);
    expect(
      ownerFeed.notifications.find((row) => row.id === activeActorNotice.id)
        ?.actorDisplayName,
    ).toBe("User 1");
    const ownerRow = (
      await listNotifications(member, "50", null, repo)
    ).notifications.find((row) => row.id === ownerActorNotice.id);
    expect(ownerRow?.actorDisplayName).toBe("User 0");
    expect(ownerRow).not.toHaveProperty("phoneNormalized");
    expect(
      ownerFeed.notifications.find((row) => row.id === otherRoomActorNotice.id)
        ?.actorDisplayName,
    ).toBeNull();

    await database.db
      .update(roomMembers)
      .set({ status: "INACTIVE" })
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, actor)),
      );
    expect(
      (await listNotifications(owner, "50", null, repo)).notifications.find(
        (row) => row.id === activeActorNotice.id,
      )?.actorDisplayName,
    ).toBeNull();

    await database.db
      .delete(roomMembers)
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, actor)),
      );
    expect(
      (await listNotifications(owner, "50", null, repo)).notifications.find(
        (row) => row.id === activeActorNotice.id,
      )?.actorDisplayName,
    ).toBeNull();
  });

  it("deduplicates a recipient who is both room owner and active participant", async () => {
    await database.db
      .insert(roomMembers)
      .values({ roomId, userId: actor, status: "ACTIVE" })
      .onConflictDoUpdate({
        target: [roomMembers.roomId, roomMembers.userId],
        set: { status: "ACTIVE" },
      });
    await database.db
      .insert(roomMembers)
      .values({ roomId, userId: owner, status: "ACTIVE" });
    try {
      const created = await createEvent(
        actor,
        roomId,
        {
          statusId,
          startDate: "2026-11-16",
          endDate: "2026-11-16",
          allDay: true,
        },
        createEventRepository(database.db),
      );
      const rows = await database.db
        .select()
        .from(notifications)
        .where(eq(notifications.eventId, created.id));
      expect(rows.filter((row) => row.toUserId === owner)).toHaveLength(1);
      expect(rows.filter((row) => row.toUserId === actor)).toHaveLength(0);
    } finally {
      await database.db
        .delete(roomMembers)
        .where(
          and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, owner)),
        );
      await database.db
        .delete(roomMembers)
        .where(
          and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, actor)),
        );
    }
  });
});
