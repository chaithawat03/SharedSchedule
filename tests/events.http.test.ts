import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  handleCreateEvent,
  handleDeleteEvent,
  handleUpdateEvent,
} from "../lib/events/http";
import { SESSION_COOKIE_NAME } from "../lib/session/cookie";
import { signInWithPhone } from "../services/session.service";
import type {
  EventRepository,
  EventTransaction,
} from "../services/event.service";
import { MemorySessionRepository } from "./helpers/memory-session-repository";

const room = "20000000-0000-4000-8000-000000000001";
const eventId = "60000000-0000-4000-8000-000000000001";
const status = "30000000-0000-4000-8000-000000000001";

function request(method: string, path: string, body?: unknown, token?: string) {
  const req = new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (token) req.cookies.set(SESSION_COOKIE_NAME, token);
  return req;
}

function repository(userId: string): EventRepository {
  const tx: EventTransaction = {
    async roomAccess(roomId, actor) {
      return roomId === room
        ? { active: true, memberActive: actor === userId }
        : null;
    },
    async event() {
      return null;
    },
    async status() {
      return { roomId: room, active: true };
    },
    async location() {
      return null;
    },
    async insert(input) {
      const at = new Date();
      return {
        ...input,
        id: eventId,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      };
    },
    async replace() {
      throw new Error("unexpected");
    },
    async softDelete() {
      throw new Error("unexpected");
    },
    async audit() {},
  };
  return { transaction: async (run) => run(tx) };
}

describe("event HTTP", () => {
  it("requires a session on all write methods and disables caching", async () => {
    const sessions = new MemorySessionRepository();
    const repo = repository("nobody");
    for (const response of [
      await handleCreateEvent(
        request("POST", `/api/rooms/${room}/events`, {}),
        room,
        sessions,
        repo,
      ),
      await handleUpdateEvent(
        request("PATCH", `/api/events/${eventId}`, {}),
        eventId,
        sessions,
        repo,
      ),
      await handleDeleteEvent(
        request("DELETE", `/api/events/${eventId}`),
        eventId,
        sessions,
        repo,
      ),
    ]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("returns 201 for own creation, 400 for malformed input, and 404 outside membership", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    const input = {
      statusId: status,
      startDate: "2026-10-12",
      endDate: "2026-10-12",
      allDay: true,
    };
    const created = await handleCreateEvent(
      request("POST", `/api/rooms/${room}/events`, input, login.token),
      room,
      sessions,
      repository(login.user.id),
    );
    expect(created.status).toBe(201);
    expect((await created.json()).event.ownerUserId).toBe(login.user.id);
    const invalid = await handleCreateEvent(
      request(
        "POST",
        `/api/rooms/${room}/events`,
        { ...input, endDate: "2026-10-11" },
        login.token,
      ),
      room,
      sessions,
      repository(login.user.id),
    );
    expect(invalid.status).toBe(400);
    const outside = await handleCreateEvent(
      request("POST", `/api/rooms/${room}/events`, input, login.token),
      room,
      sessions,
      repository("other"),
    );
    expect(outside.status).toBe(404);
  });
});
