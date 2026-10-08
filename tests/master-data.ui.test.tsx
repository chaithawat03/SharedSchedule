// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomMastersSettings } from "../components/rooms/RoomMastersSettings";
import { RoomDetailView } from "../components/rooms/RoomDetailView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

const roomId = "20000000-0000-4000-8000-000000000001";
const statusA = "30000000-0000-4000-8000-000000000001";
const statusB = "30000000-0000-4000-8000-000000000002";
const initialStatuses = [
  {
    id: statusA,
    code: "WORK",
    name: "Factory Shift",
    icon: null,
    color: null,
    sortOrder: 0,
    active: true,
  },
  {
    id: statusB,
    code: "TRAINING",
    name: "Training",
    icon: null,
    color: "#3366AA",
    sortOrder: 1,
    active: false,
  },
];
const initialLocations = [
  { id: "40000000-0000-4000-8000-000000000001", name: "MCP", active: true },
];

describe("room master settings UI", () => {
  it("focuses the editor close control and restores its opener on close", () => {
    render(
      <RoomMastersSettings
        roomId={roomId}
        initialStatuses={initialStatuses}
        initialLocations={initialLocations}
      />,
    );
    const opener = screen.getByRole("button", { name: "Add status" });
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole("button", { name: "Close editor" });
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    expect(document.activeElement).toBe(opener);
  });
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

  it("shows Settings only to the owner on the room page", () => {
    const room = {
      id: roomId,
      name: "Together",
      description: null,
      ownerUserId: "owner",
      status: "ACTIVE",
      participants: [],
    };
    expect(
      renderToStaticMarkup(<RoomDetailView room={room} isOwner />),
    ).toContain(`/room/${roomId}/settings`);
    expect(
      renderToStaticMarkup(<RoomDetailView room={room} isOwner={false} />),
    ).not.toContain(`/room/${roomId}/settings`);
  });

  it("separates active and inactive masters and explains retained event references", () => {
    render(
      <RoomMastersSettings
        roomId={roomId}
        initialStatuses={initialStatuses}
        initialLocations={initialLocations}
      />,
    );
    expect(screen.getByText("Factory Shift")).toBeTruthy();
    expect(screen.getByText("Training")).toBeTruthy();
    expect(
      screen.getByText(/Existing events keep their reference/),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Reactivate Training" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit Factory Shift" }));
    expect(screen.getByText("WORK")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Code" })).toBeNull();
  });

  it("submits a custom status and refreshes lists without repeating the write", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        calls.push(`${options?.method ?? "GET"} ${url}`);
        if (options?.method === "POST")
          return new Response(JSON.stringify({ status: { id: "new" } }), {
            status: 201,
          });
        if (url.endsWith("/statuses?includeInactive=1"))
          return new Response(
            JSON.stringify({
              statuses: [
                ...initialStatuses,
                {
                  id: "new",
                  code: "FIELD_WORK",
                  name: "Field Work",
                  icon: null,
                  color: null,
                  sortOrder: 1,
                  active: true,
                },
              ],
            }),
            { status: 200 },
          );
        return new Response(JSON.stringify({ locations: initialLocations }), {
          status: 200,
        });
      }),
    );
    render(
      <RoomMastersSettings
        roomId={roomId}
        initialStatuses={initialStatuses}
        initialLocations={initialLocations}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add status" }));
    fireEvent.change(screen.getByLabelText("Code"), {
      target: { value: "field_work" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Field Work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));
    await waitFor(() => expect(screen.getByText("Field Work")).toBeTruthy());
    expect(calls.filter((item) => item.startsWith("POST"))).toHaveLength(1);
    expect(calls.some((item) => item.includes("includeInactive=1"))).toBe(true);
  });
});
