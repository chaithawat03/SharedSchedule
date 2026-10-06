import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { createDatabase, getDatabase } from "../db";
import {
  events,
  locationMaster,
  roomMembers,
  rooms,
  statusMaster,
  users,
  workOverrides,
  workPatterns,
} from "../db/schema";
import type { CalendarRepository } from "../../services/calendar.service";

type Database = ReturnType<typeof createDatabase>["db"];

export function createCalendarRepository(db: Database): CalendarRepository {
  return {
    async getRoom(roomId) {
      const [room] = await db
        .select({
          id: rooms.id,
          name: rooms.name,
          description: rooms.description,
          ownerUserId: rooms.ownerUserId,
          status: rooms.status,
        })
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);
      if (!room) return null;
      const members = await db
        .select({
          userId: roomMembers.userId,
          displayName: users.displayName,
          avatarText: users.avatarText,
          defaultColor: users.defaultColor,
          joinedAt: roomMembers.joinedAt,
        })
        .from(roomMembers)
        .innerJoin(users, eq(users.id, roomMembers.userId))
        .where(
          and(eq(roomMembers.roomId, roomId), eq(roomMembers.status, "ACTIVE")),
        )
        .orderBy(roomMembers.joinedAt, roomMembers.userId);
      return { room, members };
    },

    async loadMonth(roomId, memberIds, monthStart, monthEnd) {
      const statusesQuery = db
        .select({
          id: statusMaster.id,
          roomId: statusMaster.roomId,
          code: statusMaster.code,
          name: statusMaster.name,
          icon: statusMaster.icon,
          color: statusMaster.color,
          sortOrder: statusMaster.sortOrder,
          active: statusMaster.active,
        })
        .from(statusMaster)
        .where(eq(statusMaster.roomId, roomId));
      const locationsQuery = db
        .select({
          id: locationMaster.id,
          roomId: locationMaster.roomId,
          name: locationMaster.name,
          active: locationMaster.active,
        })
        .from(locationMaster)
        .where(eq(locationMaster.roomId, roomId));

      if (memberIds.length === 0) {
        const [statuses, locations] = await Promise.all([
          statusesQuery,
          locationsQuery,
        ]);
        return { statuses, locations, patterns: [], overrides: [], events: [] };
      }

      const [statuses, locations, patterns, overrides, monthEvents] =
        await Promise.all([
          statusesQuery,
          locationsQuery,
          db
            .select({
              userId: workPatterns.userId,
              weekday: workPatterns.weekday,
              working: workPatterns.working,
              startTime: workPatterns.startTime,
              endTime: workPatterns.endTime,
            })
            .from(workPatterns)
            .where(inArray(workPatterns.userId, memberIds)),
          db
            .select({
              userId: workOverrides.userId,
              date: workOverrides.date,
              type: workOverrides.type,
              startTime: workOverrides.startTime,
              endTime: workOverrides.endTime,
              note: workOverrides.note,
            })
            .from(workOverrides)
            .where(
              and(
                inArray(workOverrides.userId, memberIds),
                gte(workOverrides.date, monthStart),
                lte(workOverrides.date, monthEnd),
              ),
            ),
          db
            .select({
              id: events.id,
              roomId: events.roomId,
              ownerUserId: events.ownerUserId,
              statusId: events.statusId,
              title: events.title,
              startDate: events.startDate,
              endDate: events.endDate,
              startTime: events.startTime,
              endTime: events.endTime,
              endTimeOpen: events.endTimeOpen,
              allDay: events.allDay,
              locationId: events.locationId,
              locationText: events.locationText,
              note: events.note,
              deletedAt: events.deletedAt,
            })
            .from(events)
            .where(
              and(
                eq(events.roomId, roomId),
                inArray(events.ownerUserId, memberIds),
                lte(events.startDate, monthEnd),
                gte(events.endDate, monthStart),
                isNull(events.deletedAt),
              ),
            ),
        ]);
      return { statuses, locations, patterns, overrides, events: monthEvents };
    },
  };
}

export function getCalendarRepository(): CalendarRepository {
  return createCalendarRepository(getDatabase().db);
}
