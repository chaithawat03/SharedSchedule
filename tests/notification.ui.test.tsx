// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsView } from "../components/notifications/NotificationsView";

const id = "70000000-0000-4000-8000-000000000001";
const item = {
  id,
  roomId: "20000000-0000-4000-8000-000000000001",
  fromUserId: "10000000-0000-4000-8000-000000000001",
  toUserId: "10000000-0000-4000-8000-000000000002",
  eventId: null,
  type: "BULK_EVENTS_CREATED",
  message: "A room member added multiple events.",
  createdAt: "2026-10-08T01:02:03.000456Z",
  readAt: null,
  roomName: "Together",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Notifications page", () => {
  it("shows an empty state and refreshes explicitly", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        notifications: [item],
        unreadCount: 1,
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <NotificationsView
        initialFeed={{ notifications: [], unreadCount: 0, nextCursor: null }}
      />,
    );
    expect(screen.getByText("No notifications yet")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() =>
      expect(
        screen.getByText("A room member added multiple events."),
      ).toBeTruthy(),
    );
    expect(screen.getByText("1 unread")).toBeTruthy();
  });

  it("marks one item read and keeps a visible error on failed refresh", async () => {
    let failRefresh = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === "PATCH")
          return Response.json({
            notification: { id, readAt: "2026-10-08T02:00:00.000Z" },
          });
        if (failRefresh)
          return Response.json({ error: "Unavailable" }, { status: 503 });
        return Response.json({
          notifications: [item],
          unreadCount: 1,
          nextCursor: null,
        });
      }),
    );
    render(
      <NotificationsView
        initialFeed={{
          notifications: [item],
          unreadCount: 1,
          nextCursor: null,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(screen.getByText("0 unread")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Mark as read" })).toBeNull();
    failRefresh = true;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(
      screen.getByText("Unable to refresh notifications. Try again."),
    ).toBeTruthy();
  });
});
