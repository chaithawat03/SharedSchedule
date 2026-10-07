import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  handleCreateStatus,
  handleGetStatuses,
  handleGetLocations,
  handlePatchStatus,
} from "../lib/master-data/http";
import { SESSION_COOKIE_NAME } from "../lib/session/cookie";
import { signInWithPhone } from "../services/session.service";
import type {
  MasterRepository,
  StatusRow,
} from "../services/master-data.service";
import { MemorySessionRepository } from "./helpers/memory-session-repository";

const room = "20000000-0000-4000-8000-000000000001";
const foreign = "30000000-0000-4000-8000-000000000099";
const status: StatusRow = {
  id: "30000000-0000-4000-8000-000000000001",
  roomId: room,
  code: "WORK",
  name: "Work",
  icon: null,
  color: null,
  sortOrder: 0,
  active: true,
  createdAt: new Date(),
};

function request(path: string, method = "GET", token?: string, body?: unknown) {
  const req = new NextRequest(`http://localhost:3000${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (token) req.cookies.set(SESSION_COOKIE_NAME, token);
  return req;
}

function repository(userId: string, isOwner: boolean): MasterRepository {
  const access = {
    id: room,
    ownerUserId: isOwner ? userId : "10000000-0000-4000-8000-000000000099",
    status: "ACTIVE",
    memberActive: !isOwner,
  };
  return {
    async readAccess(id) {
      return id === room ? access : null;
    },
    async readStatuses() {
      return [status, { ...status, id: foreign, code: "OT", active: false }];
    },
    async readLocations() {
      return [];
    },
    async transaction(run) {
      return run({
        async lockRoom() {
          return access;
        },
        async statuses() {
          return [status];
        },
        async locations() {
          return [];
        },
        async status(id) {
          return id === status.id ? status : null;
        },
        async location() {
          return null;
        },
        async insertStatus(values) {
          return { ...status, ...values };
        },
        async updateStatus(id, values) {
          return { ...status, ...values, id };
        },
        async insertLocation() {
          throw new Error("unused");
        },
        async updateLocation() {
          throw new Error("unused");
        },
        async audit() {},
      });
    },
  };
}

describe("master HTTP", () => {
  it("requires a session and returns no-store for every response", async () => {
    const sessions = new MemorySessionRepository();
    const response = await handleGetStatuses(
      request(`/api/rooms/${room}/statuses`),
      room,
      sessions,
      repository("none", false),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("gives a participant active choices but denies inactive lists and mutations", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    const repo = repository(login.user.id, false);
    const base = `/api/rooms/${room}`;
    const active = await handleGetStatuses(
      request(`${base}/statuses`, "GET", login.token),
      room,
      sessions,
      repo,
    );
    expect(
      (await active.json()).statuses.map((row: StatusRow) => row.code),
    ).toEqual(["WORK"]);
    expect(
      (
        await handleGetStatuses(
          request(`${base}/statuses?includeInactive=1`, "GET", login.token),
          room,
          sessions,
          repo,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleGetLocations(
          request(`${base}/locations?includeInactive=1`, "GET", login.token),
          room,
          sessions,
          repo,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleCreateStatus(
          request(`${base}/statuses`, "POST", login.token, {
            code: "X",
            name: "X",
          }),
          room,
          sessions,
          repo,
        )
      ).status,
    ).toBe(403);
  });

  it("checks room ownership before a foreign master ID and maps malformed input", async () => {
    const sessions = new MemorySessionRepository();
    const login = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      sessions,
    );
    if (login.requiresRegistration) throw new Error("Expected session");
    const repo = repository(login.user.id, true);
    const path = `/api/rooms/${room}/statuses`;
    const missing = await handlePatchStatus(
      request(`${path}/${foreign}`, "PATCH", login.token, { name: "Secret" }),
      room,
      foreign,
      sessions,
      repo,
    );
    expect(missing.status).toBe(404);
    expect(JSON.stringify(await missing.json())).not.toContain("Secret");
    const invalid = await handleCreateStatus(
      request(path, "POST", login.token, { code: "BAD-CODE", name: "A" }),
      room,
      sessions,
      repo,
    );
    expect(invalid.status).toBe(400);
  });
});
