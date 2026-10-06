import {
  bangkokToday,
  monthDates,
  weekdayMondayFirst,
} from "../lib/calendar/date";
import type {
  CalendarBaseSchedule,
  CalendarEvent,
  CalendarMonth,
} from "../types/calendar";

type CalendarRoom = CalendarMonth["room"];
type CalendarMemberRow = CalendarMonth["members"][number] & { joinedAt: Date };
type CalendarStatusRow = CalendarMonth["statuses"][number] & {
  roomId: string;
  active: boolean;
};
type CalendarLocationRow = CalendarMonth["locations"][number] & {
  roomId: string;
  active: boolean;
};
type CalendarPatternRow = {
  userId: string;
  weekday: number;
  working: boolean;
  startTime: string | null;
  endTime: string | null;
};
type CalendarOverrideRow = {
  userId: string;
  date: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};
type CalendarEventRow = {
  id: string;
  roomId: string;
  ownerUserId: string;
  statusId: string;
  title: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  endTimeOpen: boolean;
  allDay: boolean;
  locationId: string | null;
  locationText: string | null;
  note: string | null;
  deletedAt: Date | null;
};

export interface CalendarRepository {
  getRoom(
    roomId: string,
  ): Promise<{ room: CalendarRoom; members: CalendarMemberRow[] } | null>;
  loadMonth(
    roomId: string,
    memberIds: string[],
    monthStart: string,
    monthEnd: string,
  ): Promise<{
    statuses: CalendarStatusRow[];
    locations: CalendarLocationRow[];
    patterns: CalendarPatternRow[];
    overrides: CalendarOverrideRow[];
    events: CalendarEventRow[];
  }>;
}

export class CalendarError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

const roomIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const localTime = (value: string | null) => value?.slice(0, 5) ?? null;

function eventForClient(
  row: CalendarEventRow,
  statuses: Map<string, CalendarStatusRow>,
  locations: Map<string, CalendarLocationRow>,
): CalendarEvent {
  const status = statuses.get(row.statusId);
  const location = row.locationId ? locations.get(row.locationId) : undefined;
  return {
    eventId: row.id,
    ownerUserId: row.ownerUserId,
    statusId: status?.id ?? null,
    code: status?.code ?? "UNKNOWN",
    statusName: status?.name ?? "Unknown status",
    statusIcon: status?.icon ?? null,
    statusColor: status?.color ?? null,
    title: row.title,
    startDate: row.startDate,
    endDate: row.endDate,
    startTime: localTime(row.startTime),
    endTime: localTime(row.endTime),
    endTimeOpen: row.endTimeOpen,
    allDay: row.allDay,
    locationId: location?.id ?? null,
    locationName: location?.name ?? null,
    locationText: row.locationText,
    note: row.note,
  };
}

function baseSchedule(
  userId: string,
  date: string,
  patterns: Map<string, CalendarPatternRow>,
  overrides: Map<string, CalendarOverrideRow>,
): CalendarBaseSchedule | null {
  const override = overrides.get(`${userId}:${date}`);
  if (override) {
    const working = override.type === "WORK";
    return {
      code: working ? "WORK" : "OFF",
      startTime: working ? localTime(override.startTime) : null,
      endTime: working ? localTime(override.endTime) : null,
      source: "OVERRIDE",
      note: override.note,
    };
  }
  const pattern = patterns.get(`${userId}:${weekdayMondayFirst(date)}`);
  if (!pattern) return null;
  return {
    code: pattern.working ? "WORK" : "OFF",
    startTime: pattern.working ? localTime(pattern.startTime) : null,
    endTime: pattern.working ? localTime(pattern.endTime) : null,
    source: "PATTERN",
    note: null,
  };
}

export async function getCalendarMonth(
  currentUser: { id: string; displayName: string },
  roomId: string,
  year: number,
  month: number,
  repository: CalendarRepository,
  now = new Date(),
): Promise<CalendarMonth> {
  if (!roomIdPattern.test(roomId))
    throw new CalendarError("NOT_FOUND", "Room not found");
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new CalendarError("INVALID_INPUT", "Enter a valid year and month");
  }
  const access = await repository.getRoom(roomId);
  if (
    !access ||
    access.room.status !== "ACTIVE" ||
    (access.room.ownerUserId !== currentUser.id &&
      !access.members.some((member) => member.userId === currentUser.id))
  ) {
    throw new CalendarError("NOT_FOUND", "Room not found");
  }

  const dates = monthDates(year, month);
  const monthStart = dates[0];
  const monthEnd = dates[dates.length - 1];
  const members = [...access.members].sort((left, right) => {
    if (left.userId === currentUser.id) return -1;
    if (right.userId === currentUser.id) return 1;
    return (
      left.joinedAt.getTime() - right.joinedAt.getTime() ||
      left.userId.localeCompare(right.userId)
    );
  });
  const memberIds = members.map((member) => member.userId);
  const rows = await repository.loadMonth(
    access.room.id,
    memberIds,
    monthStart,
    monthEnd,
  );
  const statuses = rows.statuses.filter(
    (status) => status.roomId === access.room.id,
  );
  const locations = rows.locations.filter(
    (location) => location.roomId === access.room.id,
  );
  const statusMap = new Map(statuses.map((status) => [status.id, status]));
  const locationMap = new Map(
    locations.map((location) => [location.id, location]),
  );
  const patternMap = new Map(
    rows.patterns
      .filter((pattern) => memberIds.includes(pattern.userId))
      .map((pattern) => [`${pattern.userId}:${pattern.weekday}`, pattern]),
  );
  const overrideMap = new Map(
    rows.overrides
      .filter(
        (override) =>
          memberIds.includes(override.userId) &&
          override.date >= monthStart &&
          override.date <= monthEnd,
      )
      .map((override) => [`${override.userId}:${override.date}`, override]),
  );
  const days: CalendarMonth["days"] = {};
  for (const date of dates) {
    const users: CalendarMonth["days"][string]["users"] = {};
    for (const member of members) {
      users[member.userId] = {
        baseSchedule: baseSchedule(
          member.userId,
          date,
          patternMap,
          overrideMap,
        ),
        events: [],
      };
    }
    days[date] = { users };
  }

  const visibleEvents = rows.events
    .filter(
      (event) =>
        event.roomId === access.room.id &&
        memberIds.includes(event.ownerUserId) &&
        !event.deletedAt &&
        event.startDate <= monthEnd &&
        event.endDate >= monthStart,
    )
    .sort(
      (left, right) =>
        left.startDate.localeCompare(right.startDate) ||
        (left.startTime ?? "").localeCompare(right.startTime ?? "") ||
        left.id.localeCompare(right.id),
    );
  for (const event of visibleEvents) {
    const displayEvent = eventForClient(event, statusMap, locationMap);
    for (const date of dates) {
      if (date >= event.startDate && date <= event.endDate) {
        days[date].users[event.ownerUserId].events.push(displayEvent);
      }
    }
  }

  return {
    room: access.room,
    currentUser: { id: currentUser.id, displayName: currentUser.displayName },
    members: members.map(
      ({ userId, displayName, avatarText, defaultColor }) => ({
        userId,
        displayName,
        avatarText,
        defaultColor,
      }),
    ),
    statuses: statuses
      .filter((status) => status.active)
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.code.localeCompare(right.code),
      )
      .map(({ id, code, name, icon, color, sortOrder }) => ({
        id,
        code,
        name,
        icon,
        color,
        sortOrder,
      })),
    locations: locations
      .filter((location) => location.active)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ id, name }) => ({ id, name })),
    year,
    month,
    monthStart,
    monthEnd,
    today: bangkokToday(now),
    days,
  };
}
