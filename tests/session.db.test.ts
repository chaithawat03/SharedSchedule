import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../lib/db";
import { users } from "../lib/db/schema";
import { SESSION_COOKIE_NAME } from "../lib/session/cookie";
import {
  handleLoginRequest,
  handleLogoutRequest,
  handleMeRequest,
} from "../lib/session/http";
import { createSessionRepository } from "../lib/session/repository";
import { hashSessionToken } from "../lib/session/token";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = testDatabaseUrl ? describe : describe.skip;

databaseSuite("phone session PostgreSQL integration", () => {
  const localPhone = `08${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;
  const normalizedPhone = `+66${localPhone.slice(1)}`;
  let database: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    const databaseName = new URL(testDatabaseUrl!).pathname
      .slice(1)
      .toLowerCase();
    if (!databaseName.includes("test")) {
      throw new Error(
        "TEST_DATABASE_URL must point to a dedicated database with 'test' in its name",
      );
    }
    database = createDatabase(testDatabaseUrl);
    await migrate(database.db, { migrationsFolder: resolve("drizzle") });
  });

  afterAll(async () => {
    if (!database) return;
    const [user] = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNormalized, normalizedPhone))
      .limit(1);
    if (user) await database.db.delete(users).where(eq(users.id, user.id));
    await database.pool.end();
  });

  it("registers, logs in, restores, revokes, and rejects sessions through Drizzle", async () => {
    const repository = createSessionRepository(database.db);
    const loginRequest = (body: unknown) =>
      new NextRequest("http://localhost/api/session/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
    const cookieRequest = (path: string, token: string, method = "GET") =>
      new NextRequest(`http://localhost${path}`, {
        method,
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });

    const unknown = await handleLoginRequest(
      loginRequest({ phone: localPhone }),
      repository,
    );
    expect(await unknown.json()).toEqual({
      requiresRegistration: true,
      phoneDisplay: localPhone,
    });

    const registration = await handleLoginRequest(
      loginRequest({ phone: localPhone, displayName: "Integration Smart" }),
      repository,
    );
    expect(registration.status).toBe(200);
    const registeredUser = (await registration.json()).user;
    const rawToken = registration.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(rawToken).toBeTruthy();
    const [storedUser] = await database.db
      .select()
      .from(users)
      .where(eq(users.phoneNormalized, normalizedPhone));
    expect(storedUser.id).toBe(registeredUser.id);
    expect(hashSessionToken(rawToken!)).not.toBe(rawToken);

    const existing = await handleLoginRequest(
      loginRequest({ phone: `66${localPhone.slice(1)}` }),
      repository,
    );
    expect((await existing.json()).user.id).toBe(registeredUser.id);

    const me = await handleMeRequest(
      cookieRequest("/api/session/me", rawToken!),
      repository,
    );
    expect(me.status).toBe(200);
    expect((await me.json()).user.id).toBe(registeredUser.id);

    const logout = await handleLogoutRequest(
      cookieRequest("/api/session/logout", rawToken!, "POST"),
      repository,
    );
    expect(logout.status).toBe(200);
    expect(
      (
        await handleMeRequest(
          cookieRequest("/api/session/me", rawToken!),
          repository,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleMeRequest(
          cookieRequest("/api/session/me", "invalid"),
          repository,
        )
      ).status,
    ).toBe(401);
  });
});
