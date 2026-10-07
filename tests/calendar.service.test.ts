import { describe, expect, it } from "vitest";
import {
  getCalendarMonth,
  type CalendarRepository,
} from "../services/calendar.service";

const owner = "10000000-0000-4000-8000-000000000001";
const partner = "10000000-0000-4000-8000-000000000002";
const removed = "10000000-0000-4000-8000-000000000003";
const roomId = "20000000-0000-4000-8000-000000000001";
const otherRoom = "20000000-0000-4000-8000-000000000002";
const workStatus = "30000000-0000-4000-8000-000000000001";
const otStatus = "30000000-0000-4000-8000-000000000002";
const activityStatus = "30000000-0000-4000-8000-000000000003";
const foreignStatus = "30000000-0000-4000-8000-000000000004";
const location = "40000000-0000-4000-8000-000000000001";
const foreignLocation = "40000000-0000-4000-8000-000000000002";
const now = new Date("2026-10-11T17:30:00.000Z");
type MonthRows = Awaited<ReturnType<CalendarRepository["loadMonth"]>>;

function fixture() {
  const room = {
    id: roomId,
    name: "Together",
    description: null,
    ownerUserId: owner,
    status: "ACTIVE",
  };
  const members = [
    {
      userId: partner,
      displayName: "Partner",
      avatarText: "P",
      defaultColor: "#ffaa00",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      userId: owner,
      displayName: "Smart",
      avatarText: "S",
      defaultColor: "#00aa00",
      joinedAt: new Date("2026-02-01T00:00:00Z"),
    },
  ];
  const statuses = [
    {
      id: workStatus,
      roomId,
      code: "WORK",
      name: "Work",
      icon: null,
      color: "#1a1",
      sortOrder: 0,
      active: true,
    },
    {
      id: otStatus,
      roomId,
      code: "OT",
      name: "Overtime",
      icon: null,
      color: "#a51",
      sortOrder: 1,
      active: true,
    },
    {
      id: activityStatus,
      roomId,
      code: "ACTIVITY",
      name: "Activity",
      icon: null,
      color: "#17a",
      sortOrder: 2,
      active: true,
    },
    {
      id: foreignStatus,
      roomId: otherRoom,
      code: "SECRET",
      name: "Foreign secret",
      icon: null,
      color: "#000",
      sortOrder: 3,
      active: true,
    },
  ];
  const locations = [
    { id: location, roomId, name: "MCP", active: true },
    {
      id: foreignLocation,
      roomId: otherRoom,
      name: "Foreign location",
      active: true,
    },
  ];
  const patterns = [
    {
      userId: owner,
      weekday: 1,
      working: true,
      startTime: "07:40:00",
      endTime: "17:00:00",
    },
    {
      userId: owner,
      weekday: 7,
      working: false,
      startTime: null,
      endTime: null,
    },
  ];
  const overrides: MonthRows["overrides"] = [
    {
      userId: owner,
      date: "2026-10-12",
      type: "OFF",
      startTime: null,
      endTime: null,
      note: "Leave",
    },
  ];
  const events: MonthRows["events"] = [
    {
      id: "60000000-0000-4000-8000-000000000001",
      roomId,
      ownerUserId: owner,
      statusId: otStatus,
      title: null,
      startDate: "2026-10-12",
      endDate: "2026-10-12",
      startTime: "17:20:00",
      endTime: "19:40:00",
      endTimeOpen: true,
      allDay: false,
      locationId: location,
      locationText: null,
      note: null,
      deletedAt: null,
    },
    {
      id: "60000000-0000-4000-8000-000000000002",
      roomId,
      ownerUserId: owner,
      statusId: activityStatus,
      title: "Trip",
      startDate: "2026-09-28",
      endDate: "2026-10-02",
      startTime: null,
      endTime: null,
      endTimeOpen: false,
      allDay: true,
      locationId: null,
      locationText: "Mountain",
      note: "Bring boots",
      deletedAt: null,
    },
    {
      id: "60000000-0000-4000-8000-000000000003",
      roomId,
      ownerUserId: partner,
      statusId: foreignStatus,
      title: "Private label fallback",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
      startTime: null,
      endTime: null,
      endTimeOpen: false,
      allDay: true,
      locationId: foreignLocation,
      locationText: null,
      note: null,
      deletedAt: null,
    },
  ];
  const repository: CalendarRepository = {
    async getRoom() {
      return { room, members };
    },
    async loadMonth() {
      return { statuses, locations, patterns, overrides, events };
    },
  };
  return {
    room,
    members,
    statuses,
    locations,
    patterns,
    overrides,
    events,
    repository,
  };
}

describe("monthly calendar read model", () => {
  it("makes only one factory Saturday WORK and leaves adjacent Saturdays and OFF events separate", async () => {
    const data = fixture();
    const offStatus = "30000000-0000-4000-8000-000000000099";
    data.statuses.push({
      id: offStatus,
      roomId,
      code: "OFF",
      name: "Off",
      icon: null,
      color: "#777",
      sortOrder: 4,
      active: true,
    });
    data.patterns.push({
      userId: owner,
      weekday: 6,
      working: false,
      startTime: null,
      endTime: null,
    });
    data.overrides.splice(0, data.overrides.length, {
      userId: owner,
      date: "2026-10-10",
      type: "WORK",
      startTime: "07:40:00",
      endTime: "17:00:00",
      note: "Factory working Saturday",
    });
    const offEvent: MonthRows["events"][number] = {
      ...data.events[0],
      id: "60000000-0000-4000-8000-000000000099",
      startDate: "2026-10-10",
      endDate: "2026-10-10",
      statusId: offStatus,
      startTime: null,
      endTime: null,
      allDay: true,
    };
    data.events.push(offEvent);
    const month = await getCalendarMonth(
      { id: owner, displayName: "Smart" },
      roomId,
      2026,
      10,
      data.repository,
      now,
    );
    expect(month.days["2026-10-03"].users[owner].baseSchedule?.code).toBe(
      "OFF",
    );
    expect(month.days["2026-10-10"].users[owner].baseSchedule).toMatchObject({
      code: "WORK",
      source: "OVERRIDE",
      startTime: "07:40",
    });
    expect(month.days["2026-10-17"].users[owner].baseSchedule?.code).toBe(
      "OFF",
    );
    expect(month.days["2026-10-10"].users[owner].events).toHaveLength(1);
    expect(month.days["2026-10-10"].users[owner].events[0].code).toBe("OFF");
  });
  it("orders the current participant first and combines override with additive OT", async () => {
    const data = fixture();
    const month = await getCalendarMonth(
      { id: owner, displayName: "Smart" },
      roomId,
      2026,
      10,
      data.repository,
      now,
    );
    expect(month.members.map((member) => member.userId)).toEqual([
      owner,
      partner,
    ]);
    expect(month.today).toBe("2026-10-12");
    expect(month.monthStart).toBe("2026-10-01");
    expect(month.monthEnd).toBe("2026-10-31");
    expect(Object.keys(month.days)).toHaveLength(31);
    expect(month.days["2026-10-12"].users[owner].baseSchedule).toEqual({
      code: "OFF",
      startTime: null,
      endTime: null,
      source: "OVERRIDE",
      note: "Leave",
    });
    expect(month.days["2026-10-12"].users[owner].events).toEqual([
      expect.objectContaining({
        eventId: data.events[0].id,
        code: "OT",
        startTime: "17:20",
        endTime: "19:40",
        endTimeOpen: true,
        locationName: "MCP",
      }),
    ]);
    expect(month.days["2026-10-11"].users[owner].baseSchedule?.code).toBe(
      "OFF",
    );
    expect(month.days["2026-10-13"].users[partner].baseSchedule).toBeNull();
  });

  it("shows WORK pattern and multiple same-day events without replacement", async () => {
    const data = fixture();
    data.overrides.length = 0;
    data.events.push({
      ...data.events[0],
      id: "60000000-0000-4000-8000-000000000004",
      statusId: workStatus,
      title: "Meeting",
    });
    const month = await getCalendarMonth(
      { id: owner, displayName: "Smart" },
      roomId,
      2026,
      10,
      data.repository,
      now,
    );
    const day = month.days["2026-10-12"].users[owner];
    expect(day.baseSchedule).toEqual({
      code: "WORK",
      startTime: "07:40",
      endTime: "17:00",
      source: "PATTERN",
      note: null,
    });
    expect(day.events.map((event) => event.eventId)).toEqual([
      data.events[0].id,
      data.events[3].id,
    ]);
  });

  it("expands all-day and timed spans inclusively while retaining original times", async () => {
    const data = fixture();
    data.events.push({
      ...data.events[0],
      id: "60000000-0000-4000-8000-000000000005",
      startDate: "2026-10-30",
      endDate: "2026-11-02",
      startTime: "22:00:00",
      endTime: "06:00:00",
      endTimeOpen: false,
    });
    data.events.push({
      ...data.events[1],
      id: "60000000-0000-4000-8000-000000000006",
      startDate: "2026-09-01",
      endDate: "2026-11-30",
    });
    const month = await getCalendarMonth(
      { id: partner, displayName: "Partner" },
      roomId,
      2026,
      10,
      data.repository,
      now,
    );
    expect(month.members.map((member) => member.userId)).toEqual([
      partner,
      owner,
    ]);
    const first = month.days["2026-10-01"].users[owner].events;
    expect(first.map((event) => event.eventId)).toContain(data.events[1].id);
    expect(
      first.find((event) => event.eventId === data.events[1].id),
    ).toMatchObject({
      startDate: "2026-09-28",
      endDate: "2026-10-02",
      allDay: true,
    });
    expect(
      month.days["2026-10-02"].users[owner].events.map(
        (event) => event.eventId,
      ),
    ).toContain(data.events[1].id);
    expect(
      month.days["2026-10-03"].users[owner].events.map(
        (event) => event.eventId,
      ),
    ).not.toContain(data.events[1].id);
    expect(
      month.days["2026-10-30"].users[owner].events.find(
        (event) => event.eventId === data.events[3].id,
      ),
    ).toMatchObject({
      startDate: "2026-10-30",
      endDate: "2026-11-02",
      startTime: "22:00",
      endTime: "06:00",
    });
    expect(
      month.days["2026-10-31"].users[owner].events.find(
        (event) => event.eventId === data.events[3].id,
      ),
    ).toMatchObject({
      startDate: "2026-10-30",
      endDate: "2026-11-02",
      startTime: "22:00",
      endTime: "06:00",
    });
    expect(
      month.days["2026-10-31"].users[owner].events.map(
        (event) => event.eventId,
      ),
    ).toContain(data.events[4].id);
  });

  it("lets a nonparticipant owner read an empty month without acquiring a lane", async () => {
    const data = fixture();
    data.members.length = 0;
    const month = await getCalendarMonth(
      { id: owner, displayName: "Smart" },
      roomId,
      2026,
      10,
      data.repository,
      now,
    );
    expect(month.members).toEqual([]);
    expect(Object.keys(month.days)).toHaveLength(31);
    expect(month.days["2026-10-12"].users).toEqual({});
  });

  it("excludes inactive participant events and soft-deleted events", async () => {
    const data = fixture();
    data.events.push({
      ...data.events[0],
      id: "60000000-0000-4000-8000-000000000007",
      ownerUserId: removed,
    });
    data.events.push({
      ...data.events[0],
      id: "60000000-0000-4000-8000-000000000008",
      deletedAt: new Date("2026-10-12T00:00:00Z"),
    });
    const month = await getCalendarMonth(
      { id: partner, displayName: "Partner" },
      roomId,
      2026,
      10,
      data.repository,
      now,
    );
    expect(month.days["2026-10-12"].users[removed]).toBeUndefined();
    expect(JSON.stringify(month)).not.toContain(data.events[3].id);
    expect(JSON.stringify(month)).not.toContain(data.events[4].id);
  });

  it("does not reveal cross-room status or location metadata", async () => {
    const data = fixture();
    const month = await getCalendarMonth(
      { id: partner, displayName: "Partner" },
      roomId,
      2026,
      10,
      data.repository,
      now,
    );
    const event = month.days["2026-10-12"].users[partner].events[0];
    expect(event).toMatchObject({
      code: "UNKNOWN",
      statusName: "Unknown status",
      statusId: null,
      locationId: null,
      locationName: null,
    });
    expect(JSON.stringify(month)).not.toContain("Foreign secret");
    expect(JSON.stringify(month)).not.toContain("Foreign location");
    expect(JSON.stringify(month)).not.toContain(foreignStatus);
    expect(JSON.stringify(month)).not.toContain(foreignLocation);
  });

  it("keeps room metadata and events when the requested UUID is uppercase", async () => {
    const data = fixture();
    const canonicalRoomId = "abcdefab-0000-4000-8000-000000000001";
    data.room.id = canonicalRoomId;
    for (const status of data.statuses) {
      if (status.roomId === roomId) status.roomId = canonicalRoomId;
    }
    for (const place of data.locations) {
      if (place.roomId === roomId) place.roomId = canonicalRoomId;
    }
    for (const event of data.events) event.roomId = canonicalRoomId;

    const month = await getCalendarMonth(
      { id: owner, displayName: "Smart" },
      canonicalRoomId.toUpperCase(),
      2026,
      10,
      data.repository,
      now,
    );

    expect(month.statuses.map((status) => status.code)).toContain("OT");
    expect(month.locations.map((place) => place.name)).toContain("MCP");
    expect(month.days["2026-10-12"].users[owner].events[0]).toMatchObject({
      code: "OT",
      locationName: "MCP",
    });
  });

  it("rejects nonmembers, inactive membership and invalid months", async () => {
    const data = fixture();
    await expect(
      getCalendarMonth(
        { id: removed, displayName: "Removed" },
        roomId,
        2026,
        10,
        data.repository,
        now,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      getCalendarMonth(
        { id: owner, displayName: "Smart" },
        roomId,
        2026,
        13,
        data.repository,
        now,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      getCalendarMonth(
        { id: owner, displayName: "Smart" },
        "bad",
        2026,
        10,
        data.repository,
        now,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    data.room.status = "INACTIVE";
    await expect(
      getCalendarMonth(
        { id: owner, displayName: "Smart" },
        roomId,
        2026,
        10,
        data.repository,
        now,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
