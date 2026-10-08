// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteJoiner } from "../components/rooms/InviteJoiner";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.replace.mockClear();
});

describe("invite join recovery", () => {
  it("offers a manual retry after a temporary failure and then opens the room", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "Unavailable" }, { status: 503 }),
      )
      .mockResolvedValueOnce(Response.json({ roomUrl: "/room/123" }));
    vi.stubGlobal("fetch", fetcher);
    render(<InviteJoiner token="invite-token" roomName="Together" />);
    const retry = await screen.findByRole("button", {
      name: "Retry joining room",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/room/123"),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not offer retry for a permanently exhausted invite", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { code: "EXHAUSTED", error: "Invite exhausted" },
          { status: 410 },
        ),
      ),
    );
    render(<InviteJoiner token="invite-token" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Retry joining room" }),
    ).toBeNull();
  });
});
