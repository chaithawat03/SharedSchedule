import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  handleListNotifications,
  handleMarkNotificationRead,
} from "../lib/notifications/http";
import { SESSION_COOKIE_NAME } from "../lib/session/cookie";
import { signInWithPhone } from "../services/session.service";
import type { NotificationRepository } from "../services/notification.service";
import { MemorySessionRepository } from "./helpers/memory-session-repository";

const id = "70000000-0000-4000-8000-000000000001";

function request(path: string, token?: string, method = "GET") {
  const req = new NextRequest(`http://localhost:3000${path}`, { method });
  if (token) req.cookies.set(SESSION_COOKIE_NAME, token);
  return req;
}

describe("notification HTTP", () => {
  it("requires a session and returns a no-store feed without changing read state", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    const at = "2026-10-08T01:02:03.000456Z";
    let seenLimit = 0;
    let marked = false;
    const repo: NotificationRepository = {
      list: async (userId, limit) => {
        expect(userId).toBe(login.user.id);
        seenLimit = limit;
        return [
          {
            id,
            roomId: "20000000-0000-4000-8000-000000000001",
            fromUserId: login.user.id,
            toUserId: login.user.id,
            eventId: null,
            type: "BULK_EVENTS_CREATED",
            message: "A room member added multiple events.",
            readAt: null,
            createdAt: at,
            roomName: "Room",
          },
        ];
      },
      unreadCount: async () => 4,
      markRead: async () => {
        marked = true;
        return null;
      },
    };
    const path = "/api/me/notifications";
    expect(
      (await handleListNotifications(request(path), sessions, repo)).status,
    ).toBe(401);
    const response = await handleListNotifications(
      request(path, login.token),
      sessions,
      repo,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(seenLimit).toBe(21);
    expect(await response.json()).toMatchObject({
      unreadCount: 4,
      notifications: [{ id, readAt: null }],
      nextCursor: null,
    });
    expect(marked).toBe(false);
  });

  it("rejects invalid list input and hides an inaccessible mark-read ID", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    const repo: NotificationRepository = {
      list: async () => [],
      unreadCount: async () => 0,
      markRead: async () => null,
    };
    const path = "/api/me/notifications";
    expect(
      (
        await handleListNotifications(
          request(`${path}?limit=51`, login.token),
          sessions,
          repo,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleListNotifications(
          request(`${path}?cursor=bad`, login.token),
          sessions,
          repo,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleMarkNotificationRead(
          request(`${path}/${id}/read`, login.token, "PATCH"),
          id,
          sessions,
          repo,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handleMarkNotificationRead(
          request(`${path}/${id}/read`, undefined, "PATCH"),
          id,
          sessions,
          repo,
        )
      ).status,
    ).toBe(401);
  });
});
