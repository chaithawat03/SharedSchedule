import { describe, expect, it } from "vitest";
import {
  logoutSession,
  resolveSession,
  signInWithPhone,
} from "../services/session.service";
import { hashSessionToken } from "../lib/session/token";
import { MemorySessionRepository } from "./helpers/memory-session-repository";

const now = new Date("2026-10-05T12:00:00.000Z");

describe("phone identity session service", () => {
  it("requests registration for an unknown phone without creating data", async () => {
    const repository = new MemorySessionRepository();
    const result = await signInWithPhone(
      { phone: "081-234-5678" },
      repository,
      now,
    );
    expect(result).toEqual({
      requiresRegistration: true,
      phoneDisplay: "0812345678",
    });
    expect(repository.users.size).toBe(0);
    expect(repository.sessions.size).toBe(0);
  });

  it("registers a user and stores only the session token hash", async () => {
    const repository = new MemorySessionRepository();
    const result = await signInWithPhone(
      { phone: "+66 81 234 5678", displayName: " Smart " },
      repository,
      now,
    );
    expect(result.requiresRegistration).toBe(false);
    if (result.requiresRegistration) throw new Error("Expected a session");
    expect(result.user.displayName).toBe("Smart");
    expect(repository.users.get("+66812345678")?.phoneDisplay).toBe(
      "0812345678",
    );
    expect(repository.sessions.has(result.token)).toBe(false);
    expect(repository.sessions.has(hashSessionToken(result.token))).toBe(true);
    expect(result.expiresAt.toISOString()).toBe("2026-11-04T12:00:00.000Z");
  });

  it("logs in an existing user without creating a second user", async () => {
    const repository = new MemorySessionRepository();
    await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      repository,
      now,
    );
    const result = await signInWithPhone(
      { phone: "66812345678" },
      repository,
      now,
    );
    expect(result.requiresRegistration).toBe(false);
    expect(repository.users.size).toBe(1);
    expect(repository.sessions.size).toBe(2);
  });

  it("rejects a missing or invalid registration name", async () => {
    const repository = new MemorySessionRepository();
    await expect(
      signInWithPhone(
        { phone: "0812345678", displayName: "  " },
        repository,
        now,
      ),
    ).rejects.toThrow("Enter a display name");
    expect(repository.users.size).toBe(0);
  });

  it("restores a valid session and throttles last-active writes", async () => {
    const repository = new MemorySessionRepository();
    const result = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      repository,
      now,
    );
    if (result.requiresRegistration) throw new Error("Expected a session");
    expect(
      await resolveSession(
        result.token,
        repository,
        new Date(now.getTime() + 30_000),
      ),
    ).toEqual(result.user);
    expect(repository.touchCount).toBe(0);
    expect(
      await resolveSession(
        result.token,
        repository,
        new Date(now.getTime() + 2 * 60 * 60 * 1000),
      ),
    ).toEqual(result.user);
    expect(repository.touchCount).toBe(1);
  });

  it("rejects expired, revoked, and malformed sessions", async () => {
    const repository = new MemorySessionRepository();
    const result = await signInWithPhone(
      { phone: "0812345678", displayName: "Smart" },
      repository,
      now,
    );
    if (result.requiresRegistration) throw new Error("Expected a session");
    expect(
      await resolveSession(result.token, repository, result.expiresAt),
    ).toBeNull();
    expect(await resolveSession("invalid", repository, now)).toBeNull();
    await logoutSession(result.token, repository);
    expect(
      repository.sessions.get(hashSessionToken(result.token))?.status,
    ).toBe("REVOKED");
    expect(await resolveSession(result.token, repository, now)).toBeNull();
  });
});
