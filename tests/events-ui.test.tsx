// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventForm, initialEventForm } from "../components/events/EventForm";
import {
  MonthCalendar,
  reloadDisplayedCalendarMonth,
} from "../components/calendar/MonthCalendar";
import { DayDetailSheet } from "../components/calendar/DayDetailSheet";
import { monthDates } from "../lib/calendar/date";
import type { CalendarMonth, CalendarEvent } from "../types/calendar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));
const alice = "10000000-0000-4000-8000-000000000001";
const bob = "10000000-0000-4000-8000-000000000002";
const event: CalendarEvent = {
  eventId: "60000000-0000-4000-8000-000000000001",
  ownerUserId: alice,
  statusId: "30000000-0000-4000-8000-000000000001",
  code: "OT",
  statusName: "OT",
  statusIcon: null,
  statusColor: null,
  title: null,
  startDate: "2026-10-12",
  endDate: "2026-10-12",
  startTime: "17:20",
  endTime: "19:40",
  endTimeOpen: true,
  allDay: false,
  locationId: null,
  locationName: null,
  locationText: null,
  note: null,
};
function model(
  currentUserId = alice,
  participants = [alice, bob],
): CalendarMonth {
  const days: CalendarMonth["days"] = {};
  for (const date of monthDates(2026, 10)) {
    days[date] = {
      users: Object.fromEntries(
        participants.map((id) => [
          id,
          {
            baseSchedule:
              id === alice && date === "2026-10-12"
                ? {
                    code: "WORK" as const,
                    source: "PATTERN" as const,
                    startTime: "07:40",
                    endTime: "17:00",
                    note: null,
                  }
                : null,
            events: date === "2026-10-12" && id === alice ? [event] : [],
          },
        ]),
      ),
    };
  }
  return {
    room: {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Together",
      description: null,
      ownerUserId: alice,
      status: "ACTIVE",
    },
    currentUser: { id: currentUserId, displayName: "User" },
    members: participants.map((id) => ({
      userId: id,
      displayName: id === alice ? "Alice" : "Bob",
      avatarText: null,
      defaultColor: null,
    })),
    statuses: [
      {
        id: event.statusId!,
        code: "OT",
        name: "OT",
        icon: null,
        color: null,
        sortOrder: 0,
      },
    ],
    locations: [],
    year: 2026,
    month: 10,
    monthStart: "2026-10-01",
    monthEnd: "2026-10-31",
    today: "2026-10-12",
    days,
  };
}
describe("event UI", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a visible refresh retry after create without posting the event twice", async () => {
    const created = {
      ...event,
      eventId: "60000000-0000-4000-8000-000000000009",
      title: "New shift",
      startDate: "2026-10-13",
      endDate: "2026-10-13",
      allDay: true,
      startTime: null,
      endTime: null,
      endTimeOpen: false,
    };
    const refreshed = model();
    refreshed.days["2026-10-13"].users[alice].events = [created];
    let posts = 0;
    let refreshes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          posts++;
          return Response.json({ event: created }, { status: 201 });
        }
        refreshes++;
        return refreshes === 1
          ? new Response(null, { status: 503 })
          : Response.json(refreshed);
      }),
    );

    render(<MonthCalendar initialModel={model()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Open October 13, 2026" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Add my schedule/ }));
    expect(
      (screen.getByLabelText("Start date") as HTMLInputElement).value,
    ).toBe("2026-10-13");
    expect((screen.getByLabelText("End date") as HTMLInputElement).value).toBe(
      "2026-10-13",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save event" }));

    const retry = await screen.findByRole("button", {
      name: "Retry calendar refresh",
    });
    expect(retry.closest("dialog")).not.toBeNull();
    expect(
      within(retry.closest("dialog")!).getByRole("alert").textContent,
    ).toContain("calendar could not refresh");
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText(/New shift/)).toBeTruthy());
    expect(posts).toBe(1);
    expect(refreshes).toBe(2);
  });

  it("removes an edited event from the selected day after moving its dates", async () => {
    const initial = model();
    initial.days["2026-10-12"].users[alice].events = [
      { ...event, title: "Old event" },
    ];
    const refreshed = model();
    refreshed.days["2026-10-12"].users[alice].events = [];
    refreshed.days["2026-10-13"].users[alice].events = [
      {
        ...event,
        title: "Old event",
        startDate: "2026-10-13",
        endDate: "2026-10-13",
      },
    ];
    let patches = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options?: RequestInit) => {
        if (options?.method === "PATCH") {
          patches++;
          return Response.json({
            event: refreshed.days["2026-10-13"].users[alice].events[0],
          });
        }
        return Response.json(refreshed);
      }),
    );

    render(<MonthCalendar initialModel={initial} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Open October 12, 2026" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Edit my event" }),
    );
    fireEvent.change(within(dialog).getByLabelText("Start date"), {
      target: { value: "2026-10-13" },
    });
    fireEvent.change(within(dialog).getByLabelText("End date"), {
      target: { value: "2026-10-13" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save event" }));
    await waitFor(() => {
      expect(within(dialog).getByText("October 12, 2026")).toBeTruthy();
      expect(within(dialog).queryByText(/Old event/)).toBeNull();
    });
    expect(patches).toBe(1);
  });

  it("requires confirmation before deleting and refreshes the selected day", async () => {
    const initial = model();
    initial.days["2026-10-12"].users[alice].events = [
      { ...event, title: "Delete me" },
    ];
    const refreshed = model();
    refreshed.days["2026-10-12"].users[alice].events = [];
    let deletes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options?: RequestInit) => {
        if (options?.method === "DELETE") {
          deletes++;
          return Response.json({
            event: { ...event, deletedAt: new Date().toISOString() },
          });
        }
        return Response.json(refreshed);
      }),
    );

    render(<MonthCalendar initialModel={initial} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Open October 12, 2026" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Edit my event" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete my event" }),
    );
    expect(deletes).toBe(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep event" }));
    expect(
      within(dialog).queryByRole("button", { name: "Confirm delete" }),
    ).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete my event" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm delete" }),
    );
    await waitFor(() => {
      expect(within(dialog).getByText("October 12, 2026")).toBeTruthy();
      expect(within(dialog).queryByText(/Delete me/)).toBeNull();
    });
    expect(deletes).toBe(1);
  });

  it("keeps a navigated month and selected day after creating an event", async () => {
    const november = {
      ...model(),
      year: 2026,
      month: 11,
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30",
      days: Object.fromEntries(
        monthDates(2026, 11).map((date) => [
          date,
          {
            users: {
              [alice]: { baseSchedule: null, events: [] },
              [bob]: { baseSchedule: null, events: [] },
            },
          },
        ]),
      ) as CalendarMonth["days"],
    };
    const refreshed = structuredClone(november);
    refreshed.days["2026-11-02"].users[alice].events = [
      {
        ...event,
        title: "November event",
        startDate: "2026-11-02",
        endDate: "2026-11-02",
      },
    ];
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        urls.push(url);
        return options?.method === "POST"
          ? Response.json(
              { event: refreshed.days["2026-11-02"].users[alice].events[0] },
              { status: 201 },
            )
          : Response.json(urls.length === 1 ? november : refreshed);
      }),
    );

    render(<MonthCalendar initialModel={model()} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await screen.findByRole("button", { name: "Open November 2, 2026" });
    fireEvent.click(
      screen.getByRole("button", { name: "Open November 2, 2026" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Add my schedule/ }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save event" }));
    await waitFor(() =>
      expect(within(dialog).getByText(/November event/)).toBeTruthy(),
    );
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(within(dialog).getByText("November 2, 2026")).toBeTruthy();
    expect(urls).toEqual([
      `/api/rooms/${november.room.id}/calendar?year=2026&month=11`,
      `/api/rooms/${november.room.id}/events`,
      `/api/rooms/${november.room.id}/calendar?year=2026&month=11`,
    ]);
  });

  it("shows add for participants and edit only beside their own event, never the WORK base schedule", () => {
    const owner = renderToStaticMarkup(
      <DayDetailSheet
        date="2026-10-12"
        model={model()}
        onClose={() => undefined}
        onMutated={async () => true}
      />,
    );
    expect(owner).toContain("Add my schedule");
    expect(owner).toContain("Edit my event");
    expect(owner).toContain("Weekly pattern");
    expect(owner).not.toContain("Edit WORK");
    const other = renderToStaticMarkup(
      <DayDetailSheet
        date="2026-10-12"
        model={model(bob)}
        onClose={() => undefined}
        onMutated={async () => true}
      />,
    );
    expect(other).toContain("Add my schedule");
    expect(other).not.toContain("Edit my event");
    const nonparticipant = renderToStaticMarkup(
      <DayDetailSheet
        date="2026-10-12"
        model={model(alice, [bob])}
        onClose={() => undefined}
        onMutated={async () => true}
      />,
    );
    expect(nonparticipant).not.toContain("Add my schedule");
  });

  it("prefills both dates from the selected day and presents confirmation before deletion", () => {
    expect(initialEventForm("2026-10-12")).toMatchObject({
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    });
    const html = renderToStaticMarkup(
      <EventForm
        roomId="room"
        selectedDate="2026-10-12"
        statuses={model().statuses}
        locations={[]}
        event={event}
        onCancel={() => undefined}
        onSaved={async () => true}
      />,
    );
    expect(html).toContain("Delete my event");
    expect(html).not.toContain("Confirm delete");
  });

  it("refetches the displayed navigated month after a mutation", async () => {
    const view = { ...model(), year: 2027, month: 1 };
    const urls: string[] = [];
    const request = (async (url: string) => {
      urls.push(url);
      return Response.json(view);
    }) as typeof fetch;
    const refreshed = await reloadDisplayedCalendarMonth(view, request);
    expect(refreshed.month).toBe(1);
    expect(urls).toEqual([
      `/api/rooms/${view.room.id}/calendar?year=2027&month=1`,
    ]);
  });
});
