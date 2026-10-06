import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { handleGetCalendar } from "../lib/calendar/http";
import { SESSION_COOKIE_NAME } from "../lib/session/cookie";
import { signInWithPhone } from "../services/session.service";
import { MemorySessionRepository } from "./helpers/memory-session-repository";
import type { CalendarRepository } from "../services/calendar.service";

const ownerId = "10000000-0000-4000-8000-000000000001";
const roomId = "20000000-0000-4000-8000-000000000001";

function calendarRepository(): CalendarRepository {
  return {
    async getRoom() {
      return {
        room: {
          id: roomId,
          name: "Together",
          description: null,
          ownerUserId: ownerId,
          status: "ACTIVE",
        },
        members: [],
      };
    },
    async loadMonth() {
      return {
        statuses: [],
        locations: [],
        patterns: [],
        overrides: [],
        events: [],
      };
    },
  };
}

function request(query: string, token?: string) {
  const request = new NextRequest(
    `http://localhost:3000/api/rooms/${roomId}/calendar${query}`,
  );
  if (token) request.cookies.set(SESSION_COOKIE_NAME, token);
  return request;
}

describe("calendar HTTP", () => {
  it("rejects an unauthenticated request before reading room data", async () => {
    const response = await handleGetCalendar(
      request("?year=2026&month=10"),
      roomId,
      new MemorySessionRepository(),
      calendarRepository(),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects malformed and out-of-range month inputs", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    for (const query of [
      "",
      "?year=2026.5&month=10",
      "?year=2026&month=0",
      "?year=2026&month=13",
    ]) {
      const response = await handleGetCalendar(
        request(query, login.token),
        roomId,
        sessions,
        calendarRepository(),
      );
      expect(response.status).toBe(400);
    }
  });

  it("returns a complete month without a participant lane for a nonparticipant owner", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    const repository = calendarRepository();
    const userId = login.user.id;
    repository.getRoom = async () => ({
      room: {
        id: roomId,
        name: "Together",
        description: null,
        ownerUserId: userId,
        status: "ACTIVE",
      },
      members: [],
    });
    const response = await handleGetCalendar(
      request("?year=2026&month=10", login.token),
      roomId,
      sessions,
      repository,
    );
    const model = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(model).toMatchObject({
      room: { id: roomId },
      currentUser: { id: userId },
      year: 2026,
      month: 10,
      monthStart: "2026-10-01",
      monthEnd: "2026-10-31",
      members: [],
    });
    expect(Object.keys(model.days)).toHaveLength(31);
    expect(model.days["2026-10-12"].users).toEqual({});
  });

  it("hides rooms from unrelated users", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0899999999", displayName: "Stranger" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    const response = await handleGetCalendar(
      request("?year=2026&month=10", login.token),
      roomId,
      sessions,
      calendarRepository(),
    );
    expect(response.status).toBe(404);
  });
});
