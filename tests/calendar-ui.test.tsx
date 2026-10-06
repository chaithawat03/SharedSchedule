import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  loadAdjacentCalendarMonth,
  MonthCalendar,
  visibleCalendarModel,
} from "../components/calendar/MonthCalendar";
import { DayDetailSheet } from "../components/calendar/DayDetailSheet";
import { formatEventTiming } from "../components/calendar/MemberScheduleLane";
import { RoomDetailView } from "../components/rooms/RoomDetailView";
import { monthDates } from "../lib/calendar/date";
import type { CalendarEvent, CalendarMonth } from "../types/calendar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

const owner = "10000000-0000-4000-8000-000000000001";
const partner = "10000000-0000-4000-8000-000000000002";
const ot: CalendarEvent = {
  eventId: "60000000-0000-4000-8000-000000000001",
  ownerUserId: owner,
  statusId: "30000000-0000-4000-8000-000000000002",
  code: "OT",
  statusName: "Overtime",
  statusIcon: null,
  statusColor: "#a51",
  title: null,
  startDate: "2026-10-12",
  endDate: "2026-10-12",
  startTime: "17:20",
  endTime: "19:40",
  endTimeOpen: true,
  allDay: false,
  locationId: null,
  locationName: "MCP",
  locationText: null,
  note: null,
};

function fixture(empty = false): CalendarMonth {
  const members = empty
    ? []
    : [
        {
          userId: owner,
          displayName: "Smart",
          avatarText: "S",
          defaultColor: "#00aa00",
        },
        {
          userId: partner,
          displayName: "Partner",
          avatarText: "P",
          defaultColor: "#ffaa00",
        },
      ];
  const days: CalendarMonth["days"] = {};
  for (const date of monthDates(2026, 10)) {
    days[date] = {
      users: empty
        ? {}
        : {
            [owner]: {
              baseSchedule:
                date === "2026-10-12"
                  ? {
                      code: "WORK",
                      startTime: "07:40",
                      endTime: "17:00",
                      source: "PATTERN",
                      note: null,
                    }
                  : null,
              events: date === "2026-10-12" ? [ot] : [],
            },
            [partner]: { baseSchedule: null, events: [] },
          },
    };
  }
  return {
    room: {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Together",
      description: null,
      ownerUserId: owner,
      status: "ACTIVE",
    },
    currentUser: { id: owner, displayName: "Smart" },
    members,
    statuses: [],
    locations: [],
    year: 2026,
    month: 10,
    monthStart: "2026-10-01",
    monthEnd: "2026-10-31",
    today: "2026-10-12",
    days,
  };
}

describe("calendar UI", () => {
  it("renders an empty room with a valid month grid and navigation controls", () => {
    const html = renderToStaticMarkup(
      <MonthCalendar initialModel={fixture(true)} />,
    );
    expect(html).toContain("No calendar participants yet");
    expect(html).toContain("October 2026");
    expect(html).toContain('aria-label="Previous month"');
    expect(html).toContain('aria-label="Next month"');
    expect(html).toContain('aria-label="Monday"');
    expect(html).toContain('aria-label="Sunday"');
    expect(html).toContain('aria-label="Open October 12, 2026"');
  });

  it("puts the calendar on the room page in place of the milestone placeholder", () => {
    const model = fixture(true);
    const html = renderToStaticMarkup(
      <RoomDetailView
        room={{ ...model.room, participants: [] }}
        isOwner
        calendar={model}
      />,
    );
    expect(html).toContain("Monthly calendar");
    expect(html).toContain("No calendar participants yet");
    expect(html).not.toContain("Calendar is next");
  });

  it("uses fresh server data after a room refresh, including when the owner joins", () => {
    const initial = fixture(true);
    const navigated = { ...initial, year: 2026, month: 11 };
    const refreshed = fixture();
    const clientView = { source: initial, model: navigated };
    expect(visibleCalendarModel(clientView, initial)).toBe(navigated);
    expect(visibleCalendarModel(clientView, refreshed)).toBe(refreshed);
    expect(visibleCalendarModel(clientView, refreshed).members).toHaveLength(2);
  });

  it("requests the adjacent month with one calendar response across a year boundary", async () => {
    const december = { ...fixture(), year: 2026, month: 12 };
    const january = { ...fixture(), year: 2027, month: 1 };
    const requests: string[] = [];
    const request = (async (url: string, options: RequestInit) => {
      requests.push(url);
      expect(options.cache).toBe("no-store");
      return Response.json(january);
    }) as typeof fetch;
    const result = await loadAdjacentCalendarMonth(december, 1, request);
    expect(result.year).toBe(2027);
    expect(result.month).toBe(1);
    expect(requests).toEqual([
      `/api/rooms/${december.room.id}/calendar?year=2027&month=1`,
    ]);
  });

  it("keeps month cells concise while exposing all members through the day sheet", () => {
    const model = fixture();
    const grid = renderToStaticMarkup(<MonthCalendar initialModel={model} />);
    expect(grid).toContain("WORK");
    expect(grid).toContain("OT");
    expect(grid).not.toContain("17:20");
    const detail = renderToStaticMarkup(
      <DayDetailSheet
        date="2026-10-12"
        model={model}
        onClose={() => undefined}
      />,
    );
    expect(detail).toContain("<dialog");
    expect(detail).toContain('aria-modal="true"');
    expect(detail).toContain('aria-label="Close day detail"');
    expect(detail).toContain("Smart");
    expect(detail).toContain("Partner");
    expect(detail).toContain("07:40");
    expect(detail).toContain("17:20");
    expect(detail).toContain("19:40+");
    expect(detail).toContain("MCP");
    expect(detail).not.toContain("Edit");
  });

  it("shows all-day activity across dates and labels timed multi-day events as a span", () => {
    const model = fixture();
    const trip: CalendarEvent = {
      ...ot,
      eventId: "trip",
      code: "ACTIVITY",
      statusName: "Activity",
      title: "Phu Soi Dao",
      startDate: "2026-10-12",
      endDate: "2026-10-14",
      startTime: null,
      endTime: null,
      endTimeOpen: false,
      allDay: true,
      locationName: null,
      locationText: "Mountain",
      note: "Bring boots",
    };
    for (const date of ["2026-10-12", "2026-10-13", "2026-10-14"])
      model.days[date].users[owner].events.push(trip);
    const detail = renderToStaticMarkup(
      <DayDetailSheet
        date="2026-10-13"
        model={model}
        onClose={() => undefined}
      />,
    );
    expect(detail).toContain("Phu Soi Dao");
    expect(detail).toContain("2026-10-12");
    expect(detail).toContain("2026-10-14");
    expect(detail).toContain("Bring boots");
    expect(
      formatEventTiming({
        ...trip,
        allDay: false,
        startTime: "22:00",
        endTime: "06:00",
      }),
    ).toBe("Continuous span · 2026-10-12 22:00 → 2026-10-14 06:00");
  });
});
