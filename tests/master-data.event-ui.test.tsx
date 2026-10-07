// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventForm } from "../components/events/EventForm";
import { BulkEventEditor } from "../components/events/BulkEventEditor";
import type { CalendarEvent, CalendarMonth } from "../types/calendar";

const roomId = "20000000-0000-4000-8000-000000000001";
const statusId = "30000000-0000-4000-8000-000000000001";
const locationId = "40000000-0000-4000-8000-000000000001";
const statuses: CalendarMonth["statuses"] = [
  {
    id: statusId,
    code: "OT",
    name: "Overtime",
    icon: null,
    color: null,
    sortOrder: 0,
  },
];
const locations: CalendarMonth["locations"] = [{ id: locationId, name: "MCP" }];
const event: CalendarEvent = {
  eventId: "60000000-0000-4000-8000-000000000001",
  ownerUserId: "owner",
  statusId,
  code: "OT",
  statusName: "Overtime",
  statusIcon: null,
  statusColor: null,
  title: "Trip",
  startDate: "2026-10-07",
  endDate: "2026-10-07",
  startTime: null,
  endTime: null,
  endTimeOpen: false,
  allDay: true,
  locationId,
  locationName: "MCP",
  locationText: null,
  note: null,
};

describe("event editors after master changes", () => {
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

  it("keeps an event's historical inactive status and location selectable on edit", () => {
    render(
      <EventForm
        roomId={roomId}
        selectedDate="2026-10-07"
        event={event}
        statuses={[]}
        locations={[]}
        onCancel={() => undefined}
        onSaved={async () => true}
      />,
    );
    expect(
      screen.getByRole("option", { name: "Overtime (inactive)" }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "MCP (inactive)" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Save event" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("refreshes stale individual choices while retaining unsaved event fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: "INVALID_INPUT",
              error: "Select an active status from this room",
            }),
            { status: 400 },
          ),
      ),
    );
    function Wrapper() {
      const [choices, setChoices] = useState(statuses);
      return (
        <EventForm
          roomId={roomId}
          selectedDate="2026-10-07"
          statuses={choices}
          locations={locations}
          onCancel={() => undefined}
          onSaved={async () => true}
          onChoicesStale={async () => {
            setChoices([]);
            return true;
          }}
        />
      );
    }
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Keep this title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save event" }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Save event" })
          .hasAttribute("disabled"),
      ).toBe(true),
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Keep this title",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Select an active status",
    );
  });

  it("refreshes stale bulk choices without repeating its POST or changing selected dates", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "INVALID_INPUT",
            error: "Select an active status from this room",
          }),
          { status: 400 },
        ),
    );
    vi.stubGlobal("fetch", request);
    function Wrapper() {
      const [choices, setChoices] = useState(statuses);
      return (
        <BulkEventEditor
          roomId={roomId}
          dates={["2026-10-07", "2026-10-09"]}
          statuses={choices}
          locations={locations}
          onClose={() => undefined}
          onCreated={async () => true}
          onChoicesStale={async () => {
            setChoices([]);
            return true;
          }}
        />
      );
    }
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Keep bulk title" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add to selected dates" }),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Add to selected dates" })
          .hasAttribute("disabled"),
      ).toBe(true),
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Keep bulk title",
    );
    expect(screen.getByText(/Add to 2 selected dates/)).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("blocks a rejected individual choice even when the refresh fails", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "INVALID_INPUT",
            error: "Select an active status from this room",
          }),
          { status: 400 },
        ),
    );
    vi.stubGlobal("fetch", request);
    render(
      <EventForm
        roomId={roomId}
        selectedDate="2026-10-07"
        statuses={statuses}
        locations={locations}
        onCancel={() => undefined}
        onSaved={async () => true}
        onChoicesStale={async () => false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save event" }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Save event" })
          .hasAttribute("disabled"),
      ).toBe(true),
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("blocks a rejected bulk choice even when the refresh fails", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "INVALID_INPUT",
            error: "Select an active location from this room",
          }),
          { status: 400 },
        ),
    );
    vi.stubGlobal("fetch", request);
    render(
      <BulkEventEditor
        roomId={roomId}
        dates={["2026-10-07"]}
        statuses={statuses}
        locations={locations}
        onClose={() => undefined}
        onCreated={async () => true}
        onChoicesStale={async () => false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Master location"), {
      target: { value: locationId },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add to selected dates" }),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Add to selected dates" })
          .hasAttribute("disabled"),
      ).toBe(true),
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
