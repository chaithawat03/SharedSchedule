// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkCalendarEditor } from "../components/work-schedule/WorkCalendarEditor";
import { MonthCalendar } from "../components/calendar/MonthCalendar";
import { monthDates } from "../lib/calendar/date";
import type { CalendarMonth } from "../types/calendar";

const pattern = {
  days: [
    { weekday: 1, state: "WORK", startTime: "07:40", endTime: "17:00" },
    ...[2, 3, 4, 5].map((weekday) => ({
      weekday,
      state: "NONE",
      startTime: null,
      endTime: null,
    })),
    { weekday: 6, state: "OFF", startTime: null, endTime: null },
    { weekday: 7, state: "NONE", startTime: null, endTime: null },
  ],
};

function setup(overrides: unknown[] = []) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const method = options?.method ?? "GET";
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;
      calls.push({ url, method, body });
      if (url === "/api/me/work-pattern" && method === "GET")
        return Response.json(pattern);
      if (url.startsWith("/api/me/work-overrides?") && method === "GET")
        return Response.json({ year: 2026, month: 10, overrides });
      if (url === "/api/me/work-pattern" && method === "PUT")
        return Response.json(body);
      if (url === "/api/me/work-overrides" && method === "POST")
        return Response.json(
          {
            override: {
              ...(body as Record<string, unknown>),
              id: "40000000-0000-4000-8000-000000000001",
            },
          },
          { status: 201 },
        );
      if (url.startsWith("/api/me/work-overrides/") && method === "PATCH")
        return Response.json({
          override: {
            ...(overrides[0] as Record<string, unknown>),
            ...(body as Record<string, unknown>),
          },
        });
      if (url.startsWith("/api/me/work-overrides/") && method === "DELETE")
        return Response.json({ override: overrides[0] });
      throw new Error(`${method} ${url}`);
    }),
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("personal work calendar editor", () => {
  it("shows only exceptions for the selected month while navigating", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/me/work-pattern") return Response.json(pattern);
        const november = url.includes("month=11");
        return Response.json({
          overrides: [
            {
              id: november
                ? "40000000-0000-4000-8000-000000000011"
                : "40000000-0000-4000-8000-000000000010",
              date: november ? "2026-11-07" : "2026-10-10",
              type: "OFF",
              startTime: null,
              endTime: null,
              note: november ? "November closure" : "October closure",
            },
          ],
        });
      }),
    );
    render(
      <WorkCalendarEditor initialYear={2026} initialMonth={10} standalone />,
    );
    expect(await screen.findByText("October closure")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Next exception month" }),
    );
    expect(screen.queryByText("October closure")).toBeNull();
    expect(await screen.findByText("November closure")).toBeTruthy();
  });

  it("explains global scope, shows three weekday states, and saves exactly seven days", async () => {
    const calls = setup();
    render(
      <WorkCalendarEditor initialYear={2026} initialMonth={10} standalone />,
    );
    expect(
      await screen.findByText(
        "Your work calendar is personal and applies to every room you join.",
      ),
    ).toBeTruthy();
    const monday = within(screen.getByRole("group", { name: "Monday" }));
    expect((monday.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "WORK",
    );
    expect(monday.getByLabelText("Start time")).toBeTruthy();
    fireEvent.change(monday.getByRole("combobox"), {
      target: { value: "OFF" },
    });
    expect(monday.queryByLabelText("Start time")).toBeNull();
    const sunday = within(screen.getByRole("group", { name: "Sunday" }));
    expect((sunday.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "NONE",
    );
    fireEvent.change(sunday.getByRole("combobox"), {
      target: { value: "WORK" },
    });
    fireEvent.change(sunday.getByLabelText("Start time"), {
      target: { value: "09:00" },
    });
    fireEvent.change(sunday.getByLabelText("End time"), {
      target: { value: "18:00" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save weekly pattern" }),
    );
    await waitFor(() =>
      expect(calls.some((call) => call.method === "PUT")).toBe(true),
    );
    const saved = calls.find((call) => call.method === "PUT")!.body as {
      days: {
        state: string;
        startTime: string | null;
        endTime: string | null;
      }[];
    };
    expect(saved.days).toHaveLength(7);
    expect(saved.days[0]).toMatchObject({
      state: "OFF",
      startTime: null,
      endTime: null,
    });
    expect(saved.days[6]).toMatchObject({
      state: "WORK",
      startTime: "09:00",
      endTime: "18:00",
    });
  });

  it("lists exceptions, locks the date during edit, and keeps factory Saturday times empty", async () => {
    const existing = {
      id: "40000000-0000-4000-8000-000000000002",
      date: "2026-10-24",
      type: "OFF",
      startTime: null,
      endTime: null,
      note: "Factory closure",
    };
    const calls = setup([existing]);
    render(
      <WorkCalendarEditor initialYear={2026} initialMonth={10} standalone />,
    );
    expect(await screen.findByText("Factory closure")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Exception month"), {
      target: { value: "2026-10" },
    });
    expect(screen.getByText("Factory closure")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit exception 2026-10-24" }),
    );
    expect(screen.queryByLabelText("Exception date")).toBeNull();
    expect(screen.getByText("Exception for this date")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel exception" }));
    fireEvent.click(screen.getByRole("button", { name: "Add exception" }));
    const editor = within(
      screen.getByRole("form", { name: "Exception for this date" }),
    );
    fireEvent.change(editor.getByLabelText("Exception date"), {
      target: { value: "2026-10-10" },
    });
    fireEvent.change(editor.getByLabelText("Exception type"), {
      target: { value: "WORK" },
    });
    expect(
      (editor.getByLabelText("Start time") as HTMLInputElement).value,
    ).toBe("");
    expect((editor.getByLabelText("End time") as HTMLInputElement).value).toBe(
      "",
    );
    fireEvent.change(editor.getByLabelText("Start time"), {
      target: { value: "07:40" },
    });
    fireEvent.change(editor.getByLabelText("End time"), {
      target: { value: "17:00" },
    });
    fireEvent.change(editor.getByLabelText("Exception note"), {
      target: { value: "Factory working Saturday" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save exception" }));
    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST")).toBe(true),
    );
    expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({
      date: "2026-10-10",
      type: "WORK",
      startTime: "07:40",
      endTime: "17:00",
      note: "Factory working Saturday",
    });
  });

  it("prefills only the selected date's WORK weekday and edits/deletes an exception", async () => {
    const existing = {
      id: "40000000-0000-4000-8000-000000000002",
      date: "2026-10-24",
      type: "OFF",
      startTime: null,
      endTime: null,
      note: "Closure",
    };
    const calls = setup([existing]);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(
      <WorkCalendarEditor initialYear={2026} initialMonth={10} standalone />,
    );
    await screen.findByText("Closure");
    fireEvent.click(screen.getByRole("button", { name: "Add exception" }));
    const add = within(
      screen.getByRole("form", { name: "Exception for this date" }),
    );
    fireEvent.change(add.getByLabelText("Exception date"), {
      target: { value: "2026-10-12" },
    });
    fireEvent.change(add.getByLabelText("Exception type"), {
      target: { value: "WORK" },
    });
    expect((add.getByLabelText("Start time") as HTMLInputElement).value).toBe(
      "07:40",
    );
    expect((add.getByLabelText("End time") as HTMLInputElement).value).toBe(
      "17:00",
    );
    fireEvent.click(add.getByRole("button", { name: "Cancel exception" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Edit exception 2026-10-24" }),
    );
    const edit = within(
      screen.getByRole("form", { name: "Exception for this date" }),
    );
    fireEvent.change(edit.getByLabelText("Exception note"), {
      target: { value: "Annual closure" },
    });
    fireEvent.click(edit.getByRole("button", { name: "Save exception" }));
    await waitFor(() =>
      expect(calls.some((call) => call.method === "PATCH")).toBe(true),
    );
    expect(
      calls.find((call) => call.method === "PATCH")?.body,
    ).not.toHaveProperty("date");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete exception 2026-10-24" }),
    );
    await waitFor(() =>
      expect(calls.some((call) => call.method === "DELETE")).toBe(true),
    );
  });

  it("refetches the displayed room month after save and retries only that GET", async () => {
    const roomId = "20000000-0000-4000-8000-000000000001";
    const userId = "10000000-0000-4000-8000-000000000001";
    const model = (month: number): CalendarMonth => ({
      room: {
        id: roomId,
        name: "Together",
        description: null,
        ownerUserId: userId,
        status: "ACTIVE",
      },
      currentUser: { id: userId, displayName: "Smart" },
      members: [
        { userId, displayName: "Smart", avatarText: "S", defaultColor: null },
      ],
      statuses: [],
      locations: [],
      year: 2026,
      month,
      monthStart: `2026-${String(month).padStart(2, "0")}-01`,
      monthEnd: `2026-${String(month).padStart(2, "0")}-${month === 10 ? "31" : "30"}`,
      today: "2026-10-07",
      days: Object.fromEntries(
        monthDates(2026, month).map((date) => [
          date,
          { users: { [userId]: { baseSchedule: null, events: [] } } },
        ]),
      ),
    });
    const calls: string[] = [];
    let roomGets = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        calls.push(`${options?.method ?? "GET"} ${url}`);
        if (url === "/api/me/work-pattern" && !options?.method)
          return Response.json(pattern);
        if (url.startsWith("/api/me/work-overrides?"))
          return Response.json({ year: 2026, month: 11, overrides: [] });
        if (url === "/api/me/work-pattern" && options?.method === "PUT")
          return Response.json(JSON.parse(String(options.body)));
        if (url.includes("/calendar?")) {
          roomGets++;
          return roomGets === 2
            ? new Response(null, { status: 503 })
            : Response.json(model(11));
        }
        throw new Error(url);
      }),
    );
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
    render(<MonthCalendar initialModel={model(10)} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await screen.findByRole("button", { name: "Open November 2, 2026" });
    fireEvent.click(screen.getByRole("button", { name: "Work calendar" }));
    const dialog = await screen.findByRole("dialog", { name: "Work calendar" });
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: "Save weekly pattern",
      }),
    );
    const retry = await within(dialog).findByRole("button", {
      name: "Retry calendar refresh",
    });
    fireEvent.click(retry);
    await waitFor(() =>
      expect(calls.filter((call) => call.includes("/calendar?")).length).toBe(
        3,
      ),
    );
    expect(calls.filter((call) => call.includes("/calendar?"))).toEqual([
      `GET /api/rooms/${roomId}/calendar?year=2026&month=11`,
      `GET /api/rooms/${roomId}/calendar?year=2026&month=11`,
      `GET /api/rooms/${roomId}/calendar?year=2026&month=11`,
    ]);
    expect(
      calls.filter((call) => call === "PUT /api/me/work-pattern"),
    ).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeTruthy();
  });
});
