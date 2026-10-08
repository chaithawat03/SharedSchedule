import { describe, expect, it } from "vitest";
import {
  NotificationService,
  listNotifications,
  markNotificationRead,
  type NotificationWriter,
  type NotificationRepository,
  type NotificationRow,
} from "../services/notification.service";

const roomId = "20000000-0000-4000-8000-000000000001";
const actor = "10000000-0000-4000-8000-000000000001";
const owner = "10000000-0000-4000-8000-000000000002";
const member = "10000000-0000-4000-8000-000000000003";
const eventId = "60000000-0000-4000-8000-000000000001";

describe("notification service", () => {
  it("publishes generic individual notifications once per other recipient", async () => {
    const written: unknown[] = [];
    const writer: NotificationWriter = {
      recipients: async () => [actor, owner, member, owner],
      insert: async (rows) => {
        written.push(...rows);
      },
    };
    await NotificationService.publish(writer, {
      roomId,
      fromUserId: actor,
      eventId,
      type: "EVENT_CREATED",
    });
    expect(written).toEqual([
      {
        roomId,
        fromUserId: actor,
        toUserId: owner,
        eventId,
        type: "EVENT_CREATED",
        message: "A room member added an event.",
      },
      {
        roomId,
        fromUserId: actor,
        toUserId: member,
        eventId,
        type: "EVENT_CREATED",
        message: "A room member added an event.",
      },
    ]);
  });

  it("publishes one bulk summary per recipient without an event reference", async () => {
    const written: unknown[] = [];
    const writer: NotificationWriter = {
      recipients: async () => [actor, owner, member],
      insert: async (rows) => {
        written.push(...rows);
      },
    };
    await NotificationService.publish(writer, {
      roomId,
      fromUserId: actor,
      eventId: null,
      type: "BULK_EVENTS_CREATED",
    });
    expect(written).toHaveLength(2);
    expect(written).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toUserId: owner,
          eventId: null,
          message: "A room member added multiple events.",
        }),
        expect.objectContaining({
          toUserId: member,
          eventId: null,
          message: "A room member added multiple events.",
        }),
      ]),
    );
  });

  it("preserves PostgreSQL microseconds and IDs across page boundaries", async () => {
    const at = "2026-10-08T01:02:03.000456Z";
    const older = "2026-10-08T01:02:03.000123Z";
    const ids = [
      "70000000-0000-4000-8000-000000000003",
      "70000000-0000-4000-8000-000000000002",
      "70000000-0000-4000-8000-000000000001",
    ];
    const rows: NotificationRow[] = ids.map((id, index) => ({
      id,
      createdAt: index === 2 ? older : at,
      roomId,
      fromUserId: actor,
      toUserId: owner,
      eventId,
      type: "EVENT_CREATED" as const,
      message: "A room member added an event.",
      readAt: null,
      roomName: "Room",
    }));
    let seenCursor: { createdAt: string; id: string } | null = null;
    const repo: NotificationRepository = {
      list: async (_userId, _limit, cursor) => {
        seenCursor = cursor;
        return cursor
          ? rows.filter(
              (row) =>
                row.createdAt < cursor.createdAt ||
                (row.createdAt === cursor.createdAt && row.id < cursor.id),
            )
          : rows;
      },
      unreadCount: async () => 3,
      markRead: async () => null,
    };
    const first = await listNotifications(owner, "2", null, repo);
    expect(first.notifications.map((row) => row.id)).toEqual(ids.slice(0, 2));
    expect(first.unreadCount).toBe(3);
    expect(first.nextCursor).toBeTruthy();
    const second = await listNotifications(owner, "2", first.nextCursor, repo);
    expect(seenCursor).toEqual({ createdAt: at, id: ids[1] });
    expect(second.notifications.map((row) => row.id)).toEqual([ids[2]]);
    expect(second.nextCursor).toBeNull();
    await expect(
      listNotifications(owner, "51", null, repo),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      listNotifications(owner, null, "garbage", repo),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("delegates mark-read only for a valid notification id", async () => {
    const at = new Date("2026-10-08T01:02:03.000Z");
    const repo: NotificationRepository = {
      list: async () => [],
      unreadCount: async () => 0,
      markRead: async (userId, id) =>
        userId === owner && id === eventId ? { id, readAt: at } : null,
    };
    expect(await markNotificationRead(owner, eventId, repo)).toEqual({
      id: eventId,
      readAt: at,
    });
    await expect(
      markNotificationRead(owner, "bad", repo),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      markNotificationRead(actor, eventId, repo),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
