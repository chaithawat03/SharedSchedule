import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const localDate = (name: string) => date(name, { mode: "string" });
const localTime = (name: string) => time(name, { precision: 0 });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneNormalized: varchar("phone_normalized", { length: 32 })
    .notNull()
    .unique(),
  phoneDisplay: varchar("phone_display", { length: 32 }),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  avatarText: varchar("avatar_text", { length: 12 }),
  defaultColor: varchar("default_color", { length: 32 }),
  status: varchar("status", { length: 24 }).notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: varchar("status", { length: 24 }).notNull().default("ACTIVE"),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull(),
  // Administrative ownership is independent of calendar participation.
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  description: text("description"),
  status: varchar("status", { length: 24 }).notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const roomMembers = pgTable(
  "room_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 24 }).notNull().default("MEMBER"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: varchar("status", { length: 24 }).notNull().default("ACTIVE"),
  },
  (table) => [
    unique("room_members_room_user_unique").on(table.roomId, table.userId),
  ],
);

export const roomInvites = pgTable(
  "room_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    status: varchar("status", { length: 24 }).notNull().default("ACTIVE"),
    createdAt: createdAt(),
  },
  (table) => [
    check("room_invites_used_count_nonnegative", sql`${table.usedCount} >= 0`),
  ],
);

export const statusMaster = pgTable(
  "status_master",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 48 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    icon: varchar("icon", { length: 64 }),
    color: varchar("color", { length: 32 }),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [
    unique("status_master_room_code_unique").on(table.roomId, table.code),
  ],
);

export const locationMaster = pgTable(
  "location_master",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [
    unique("location_master_room_name_unique").on(table.roomId, table.name),
  ],
);

export const workPatterns = pgTable(
  "work_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    working: boolean("working").notNull(),
    startTime: localTime("start_time"),
    endTime: localTime("end_time"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("work_patterns_user_weekday_unique").on(table.userId, table.weekday),
    check("work_patterns_weekday_range", sql`${table.weekday} between 1 and 7`),
  ],
);

export const workOverrides = pgTable(
  "work_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: localDate("date").notNull(),
    type: varchar("type", { length: 24 }).notNull(),
    startTime: localTime("start_time"),
    endTime: localTime("end_time"),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("work_overrides_user_date_unique").on(table.userId, table.date),
    check("work_overrides_type_valid", sql`${table.type} in ('WORK', 'OFF')`),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    statusId: uuid("status_id")
      .notNull()
      .references(() => statusMaster.id),
    title: varchar("title", { length: 200 }),
    startDate: localDate("start_date").notNull(),
    endDate: localDate("end_date").notNull(),
    startTime: localTime("start_time"),
    endTime: localTime("end_time"),
    endTimeOpen: boolean("end_time_open").notNull().default(false),
    allDay: boolean("all_day").notNull().default(false),
    locationId: uuid("location_id").references(() => locationMaster.id),
    locationText: varchar("location_text", { length: 200 }),
    note: text("note"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("events_room_dates_idx").on(
      table.roomId,
      table.startDate,
      table.endDate,
    ),
    index("events_owner_start_idx").on(table.ownerUserId, table.startDate),
    index("events_status_idx").on(table.statusId),
    check("events_date_order", sql`${table.endDate} >= ${table.startDate}`),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id),
    eventId: uuid("event_id").references(() => events.id),
    type: varchar("type", { length: 48 }).notNull(),
    message: text("message").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index("notifications_recipient_created_idx").on(
      table.toUserId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("notifications_recipient_unread_idx")
      .on(table.toUserId)
      .where(sql`read_at is null`),
  ],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  roomId: uuid("room_id"),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  createdAt: createdAt(),
});
