import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  handleLoginRequest,
  handleLogoutRequest,
  handleMeRequest,
} from "../lib/session/http";
import { SESSION_COOKIE_NAME } from "../lib/session/cookie";
import { MemorySessionRepository } from "./helpers/memory-session-repository";

function request(
  path: string,
  options?: { method?: string; body?: unknown; token?: string },
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options?.method ?? "GET",
    headers: options?.token
      ? { cookie: `${SESSION_COOKIE_NAME}=${options.token}` }
      : undefined,
    body:
      options?.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

describe("session HTTP operations", () => {
  it("returns requiresRegistration without a cookie for an unknown phone", async () => {
    const repository = new MemorySessionRepository();
    const response = await handleLoginRequest(
      request("/api/session/login", {
        method: "POST",
        body: { phone: "0812345678" },
      }),
      repository,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requiresRegistration: true,
      phoneDisplay: "0812345678",
    });
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("registers, sets a protected cookie, restores /me, and revokes on logout", async () => {
    const repository = new MemorySessionRepository();
    const login = await handleLoginRequest(
      request("/api/session/login", {
        method: "POST",
        body: { phone: "+66 81 234 5678", displayName: "Smart" },
      }),
      repository,
    );
    expect(login.status).toBe(200);
    const loginBody = await login.json();
    expect(loginBody.user.displayName).toBe("Smart");
    expect(loginBody.token).toBeUndefined();
    const rawToken = login.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(login.headers.get("set-cookie")).toContain("Path=/");

    const me = await handleMeRequest(
      request("/api/session/me", { token: rawToken }),
      repository,
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ user: loginBody.user });

    const logout = await handleLogoutRequest(
      request("/api/session/logout", { method: "POST", token: rawToken }),
      repository,
    );
    expect(logout.status).toBe(200);
    expect(logout.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("");
    const afterLogout = await handleMeRequest(
      request("/api/session/me", { token: rawToken }),
      repository,
    );
    expect(afterLogout.status).toBe(401);
  });

  it("logs in an existing user and rejects invalid sessions", async () => {
    const repository = new MemorySessionRepository();
    await handleLoginRequest(
      request("/api/session/login", {
        method: "POST",
        body: { phone: "0812345678", displayName: "Smart" },
      }),
      repository,
    );
    const login = await handleLoginRequest(
      request("/api/session/login", {
        method: "POST",
        body: { phone: "66812345678" },
      }),
      repository,
    );
    expect(login.status).toBe(200);
    expect(repository.users.size).toBe(1);
    const invalid = await handleMeRequest(
      request("/api/session/me", { token: "invalid" }),
      repository,
    );
    expect(invalid.status).toBe(401);
  });

  it("returns a clear validation error for a malformed phone", async () => {
    const response = await handleLoginRequest(
      request("/api/session/login", { method: "POST", body: { phone: "123" } }),
      new MemorySessionRepository(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Enter a valid Thai mobile number",
    });
  });
});
