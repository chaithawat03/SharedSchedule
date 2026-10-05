import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashSessionToken,
  isSessionToken,
  sessionExpiresAt,
} from "../lib/session/token";
import { sessionCookieOptions } from "../lib/session/cookie";

describe("session token security", () => {
  it("generates distinct 256-bit URL-safe tokens", () => {
    const tokens = Array.from({ length: 24 }, createSessionToken);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens.every((token) => /^[A-Za-z0-9_-]{43}$/.test(token))).toBe(
      true,
    );
    expect(tokens.every(isSessionToken)).toBe(true);
    expect(isSessionToken("not-a-session-token")).toBe(false);
  });

  it("stores a deterministic SHA-256 hash instead of the raw token", () => {
    const rawToken = createSessionToken();
    const storedHash = hashSessionToken(rawToken);
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedHash).not.toBe(rawToken);
    expect(hashSessionToken(rawToken)).toBe(storedHash);
  });

  it("expires in 30 days and sets an HttpOnly same-site cookie", () => {
    const now = new Date("2026-10-05T00:00:00.000Z");
    const expiresAt = sessionExpiresAt(now);
    expect(expiresAt.toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(sessionCookieOptions(expiresAt, false)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 2_592_000,
    });
    expect(sessionCookieOptions(expiresAt, true).secure).toBe(true);
  });
});
