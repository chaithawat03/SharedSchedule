export type NotificationType =
  "EVENT_CREATED" | "EVENT_UPDATED" | "EVENT_DELETED" | "BULK_EVENTS_CREATED";

export type NotificationInput = {
  roomId: string;
  fromUserId: string;
  toUserId: string;
  eventId: string | null;
  type: NotificationType;
  message: string;
};

export interface NotificationWriter {
  recipients(roomId: string, actorId: string): Promise<string[]>;
  insert(rows: NotificationInput[]): Promise<void>;
}

export type NotificationRow = NotificationInput & {
  id: string;
  createdAt: string;
  readAt: Date | null;
  roomName: string;
};

export type NotificationCursor = { createdAt: string; id: string };

export interface NotificationRepository {
  list(
    userId: string,
    limit: number,
    cursor: NotificationCursor | null,
  ): Promise<NotificationRow[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(
    userId: string,
    id: string,
  ): Promise<{ id: string; readAt: Date } | null>;
}

export class NotificationError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export class NotificationService {
  static async publish(
    writer: NotificationWriter,
    input: Omit<NotificationInput, "toUserId" | "message">,
  ): Promise<void> {
    const messages: Record<NotificationType, string> = {
      EVENT_CREATED: "A room member added an event.",
      EVENT_UPDATED: "A room member changed an event.",
      EVENT_DELETED: "A room member deleted an event.",
      BULK_EVENTS_CREATED: "A room member added multiple events.",
    };
    const recipients = [
      ...new Set(await writer.recipients(input.roomId, input.fromUserId)),
    ].filter((id) => id !== input.fromUserId);
    if (recipients.length === 0) return;
    await writer.insert(
      recipients.map((toUserId) => ({
        ...input,
        toUserId,
        message: messages[input.type],
      })),
    );
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const iso = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;

function encodeCursor(row: { createdAt: string; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt, id: row.id }),
  ).toString("base64url");
}

function decodeCursor(value: string | null): NotificationCursor | null {
  if (value === null) return null;
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(value))
    throw new NotificationError("INVALID_INPUT", "Invalid cursor");
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded))
      throw new Error("Invalid cursor");
    const object = decoded as Record<string, unknown>;
    if (
      typeof object.createdAt !== "string" ||
      !iso.test(object.createdAt) ||
      typeof object.id !== "string" ||
      !uuid.test(object.id)
    )
      throw new Error("Invalid cursor");
    const milliseconds = `${object.createdAt.slice(0, 23)}Z`;
    const createdAt = new Date(milliseconds);
    if (
      !Number.isFinite(createdAt.getTime()) ||
      createdAt.toISOString() !== milliseconds ||
      encodeCursor({ createdAt: object.createdAt, id: object.id }) !== value
    )
      throw new Error("Invalid cursor");
    return { createdAt: object.createdAt, id: object.id };
  } catch {
    throw new NotificationError("INVALID_INPUT", "Invalid cursor");
  }
}

export async function listNotifications(
  userId: string,
  limitText: string | null,
  cursorText: string | null,
  repo: NotificationRepository,
) {
  if (
    limitText !== null &&
    (!/^[1-9][0-9]*$/.test(limitText) || Number(limitText) > 50)
  )
    throw new NotificationError("INVALID_INPUT", "Limit must be 1 to 50");
  const limit = limitText === null ? 20 : Number(limitText);
  const cursor = decodeCursor(cursorText);
  const [rows, unreadCount] = await Promise.all([
    repo.list(userId, limit + 1, cursor),
    repo.unreadCount(userId),
  ]);
  const notifications = rows.slice(0, limit);
  return {
    notifications,
    unreadCount,
    nextCursor:
      rows.length > limit
        ? encodeCursor(notifications[notifications.length - 1])
        : null,
  };
}

export async function markNotificationRead(
  userId: string,
  id: string,
  repo: NotificationRepository,
) {
  if (!uuid.test(id))
    throw new NotificationError("NOT_FOUND", "Notification not found");
  const row = await repo.markRead(userId, id);
  if (!row) throw new NotificationError("NOT_FOUND", "Notification not found");
  return row;
}
