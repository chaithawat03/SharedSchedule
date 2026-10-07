import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "../lib/session/cookie";
import {
  handleGetWorkPattern,
  handlePutWorkPattern,
  handleGetWorkOverrides,
  handleCreateWorkOverride,
  handlePatchWorkOverride,
  handleDeleteWorkOverride,
} from "../lib/work-schedule/http";
import { signInWithPhone } from "../services/session.service";
import type {
  WorkScheduleRepository,
  WorkScheduleTransaction,
} from "../services/work-schedule.service";
import { MemorySessionRepository } from "./helpers/memory-session-repository";

function request(method: string, path: string, token?: string, body?: unknown) {
  const req = new NextRequest(`http://localhost:3000${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
  });
  if (token) req.cookies.set(SESSION_COOKIE_NAME, token);
  return req;
}

describe("personal work calendar HTTP", () => {
  it("requires a session, returns seven days, rejects malformed writes, and uses no-store", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    const repository: WorkScheduleRepository = {
      async patterns() {
        return [];
      },
      async overrides() {
        return [];
      },
      async transaction(_userId, run) {
        return run({
          async patternRows() {
            return [];
          },
          async override() {
            return null;
          },
          async overrideForDate() {
            return null;
          },
          async insertPattern() {
            throw new Error("unexpected");
          },
          async updatePattern() {
            throw new Error("unexpected");
          },
          async deletePattern() {
            throw new Error("unexpected");
          },
          async insertOverride() {
            throw new Error("unexpected");
          },
          async updateOverride() {
            throw new Error("unexpected");
          },
          async deleteOverride() {
            throw new Error("unexpected");
          },
          async audit() {
            throw new Error("unexpected");
          },
        } satisfies WorkScheduleTransaction);
      },
    };
    expect(
      (
        await handleGetWorkPattern(
          request("GET", "/api/me/work-pattern"),
          sessions,
          repository,
        )
      ).status,
    ).toBe(401);
    const get = await handleGetWorkPattern(
      request("GET", "/api/me/work-pattern", login.token),
      sessions,
      repository,
    );
    expect(get.status).toBe(200);
    expect(get.headers.get("Cache-Control")).toBe("no-store");
    expect((await get.json()).days).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        state: "NONE",
        startTime: null,
        endTime: null,
      })),
    );
    const invalid = await handlePutWorkPattern(
      request("PUT", "/api/me/work-pattern", login.token, {
        days: [],
        userId: "other",
      }),
      sessions,
      repository,
    );
    expect(invalid.status).toBe(400);
    const month = await handleGetWorkOverrides(
      request("GET", "/api/me/work-overrides?year=2026&month=13", login.token),
      sessions,
      repository,
    );
    expect(month.status).toBe(400);
  });

  it("maps duplicate dates to 409 and other-user override IDs to 404", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    const repository: WorkScheduleRepository = {
      async patterns() {
        return [];
      },
      async overrides() {
        return [];
      },
      async transaction(_userId, run) {
        return run({
          async patternRows() {
            return [];
          },
          async override() {
            return null;
          },
          async overrideForDate() {
            return {
              id: "40000000-0000-4000-8000-000000000001",
              userId: "other",
              date: "2026-10-10",
              type: "OFF",
              startTime: null,
              endTime: null,
              note: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          },
          async insertPattern() {
            throw new Error("unexpected");
          },
          async updatePattern() {
            throw new Error("unexpected");
          },
          async deletePattern() {
            throw new Error("unexpected");
          },
          async insertOverride() {
            throw new Error("unexpected");
          },
          async updateOverride() {
            throw new Error("unexpected");
          },
          async deleteOverride() {
            throw new Error("unexpected");
          },
          async audit() {
            throw new Error("unexpected");
          },
        } satisfies WorkScheduleTransaction);
      },
    };
    const post = await handleCreateWorkOverride(
      request("POST", "/api/me/work-overrides", login.token, {
        date: "2026-10-10",
        type: "OFF",
      }),
      sessions,
      repository,
    );
    expect(post.status).toBe(409);
    expect((await post.json()).code).toBe("DUPLICATE");
    const id = "40000000-0000-4000-8000-000000000001";
    expect(
      (
        await handlePatchWorkOverride(
          request("PATCH", `/api/me/work-overrides/${id}`, login.token, {
            note: "x",
          }),
          id,
          sessions,
          repository,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handleDeleteWorkOverride(
          request("DELETE", `/api/me/work-overrides/${id}`, login.token),
          id,
          sessions,
          repository,
        )
      ).status,
    ).toBe(404);
  });
});
