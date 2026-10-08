import { and, count, desc, eq, exists, isNull, lt, or, sql } from "drizzle-orm";
import { createDatabase, getDatabase } from "../db";
import { notifications, roomMembers, rooms, users } from "../db/schema";
import type {
  NotificationRepository,
  NotificationType,
} from "../../services/notification.service";

type Database = ReturnType<typeof createDatabase>["db"];

export function createNotificationRepository(
  db: Database,
): NotificationRepository {
  function currentAccess(userId: string) {
    const activeMember = db
      .select({ id: roomMembers.id })
      .from(roomMembers)
      .where(
        and(
          eq(roomMembers.roomId, rooms.id),
          eq(roomMembers.userId, userId),
          eq(roomMembers.status, "ACTIVE"),
        ),
      );
    return exists(
      db
        .select({ id: rooms.id })
        .from(rooms)
        .where(
          and(
            eq(rooms.id, notifications.roomId),
            eq(rooms.status, "ACTIVE"),
            or(eq(rooms.ownerUserId, userId), exists(activeMember)),
          ),
        ),
    );
  }

  return {
    async list(userId, limit, cursor) {
      const cursorTime = cursor ? sql`${cursor.createdAt}::timestamptz` : null;
      const position = cursor
        ? or(
            lt(notifications.createdAt, cursorTime!),
            and(
              eq(notifications.createdAt, cursorTime!),
              lt(notifications.id, cursor.id),
            ),
          )
        : undefined;
      const rows = await db
        .select({
          id: notifications.id,
          roomId: notifications.roomId,
          fromUserId: notifications.fromUserId,
          toUserId: notifications.toUserId,
          eventId: notifications.eventId,
          type: notifications.type,
          message: notifications.message,
          readAt: notifications.readAt,
          createdAt: sql<string>`to_char(${notifications.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          roomName: rooms.name,
          actorDisplayName: users.displayName,
        })
        .from(notifications)
        .innerJoin(rooms, eq(rooms.id, notifications.roomId))
        .leftJoin(
          users,
          and(
            eq(users.id, notifications.fromUserId),
            or(
              eq(rooms.ownerUserId, users.id),
              exists(
                db
                  .select({ id: roomMembers.id })
                  .from(roomMembers)
                  .where(
                    and(
                      eq(roomMembers.roomId, notifications.roomId),
                      eq(roomMembers.userId, users.id),
                      eq(roomMembers.status, "ACTIVE"),
                    ),
                  ),
              ),
            ),
          ),
        )
        .where(
          and(
            eq(notifications.toUserId, userId),
            currentAccess(userId),
            position,
          ),
        )
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(limit);
      return rows.map((row) => ({
        ...row,
        type: row.type as NotificationType,
      }));
    },
    async unreadCount(userId) {
      const [row] = await db
        .select({ total: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.toUserId, userId),
            isNull(notifications.readAt),
            currentAccess(userId),
          ),
        );
      return row?.total ?? 0;
    },
    async markRead(userId, id) {
      const [updated] = await db
        .update(notifications)
        .set({ readAt: sql`now()` })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.toUserId, userId),
            isNull(notifications.readAt),
            currentAccess(userId),
          ),
        )
        .returning({ id: notifications.id, readAt: notifications.readAt });
      if (updated?.readAt) return { id: updated.id, readAt: updated.readAt };
      const [existing] = await db
        .select({ id: notifications.id, readAt: notifications.readAt })
        .from(notifications)
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.toUserId, userId),
            currentAccess(userId),
          ),
        )
        .limit(1);
      return existing?.readAt
        ? { id: existing.id, readAt: existing.readAt }
        : null;
    },
  };
}

export function getNotificationRepository(): NotificationRepository {
  return createNotificationRepository(getDatabase().db);
}
