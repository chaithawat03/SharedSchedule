import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../lib/db";
import {
  auditLog,
  roomInvites,
  roomMembers,
  rooms,
  users,
} from "../lib/db/schema";
import { createRoomRepository } from "../lib/rooms/repository";
import {
  createRoom,
  createRoomInvite,
  getRoom,
  joinRoomInvite,
  listRooms,
} from "../services/room.service";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;

suite("room and invite PostgreSQL integration", () => {
  let database: ReturnType<typeof createDatabase>;
  const phones = Array.from(
    { length: 4 },
    () => `08${String(randomInt(0, 100_000_000)).padStart(8, "0")}`,
  );
  const userIds: string[] = [];
  const roomIds: string[] = [];
  const at = new Date("2026-10-06T00:00:00.000Z");

  beforeAll(async () => {
    if (!new URL(testDatabaseUrl!).pathname.toLowerCase().includes("test")) {
      throw new Error(
        "TEST_DATABASE_URL must point to a dedicated database with 'test' in its name",
      );
    }
    database = createDatabase(testDatabaseUrl);
    await migrate(database.db, { migrationsFolder: resolve("drizzle") });
    for (const phone of phones) {
      const [user] = await database.db
        .insert(users)
        .values({ phoneNormalized: `+66${phone.slice(1)}`, displayName: phone })
        .returning({ id: users.id });
      userIds.push(user.id);
    }
  });

  afterAll(async () => {
    if (!database) return;
    for (const id of roomIds) {
      await database.db.delete(auditLog).where(eq(auditLog.roomId, id));
      await database.db.delete(rooms).where(eq(rooms.id, id));
    }
    for (const id of userIds)
      await database.db.delete(users).where(eq(users.id, id));
    await database.pool.end();
  });

  it("creates an empty room and lists owner and joined member without duplication", async () => {
    const repo = createRoomRepository(database.db);
    const room = await createRoom(userIds[0], { name: "Test room" }, repo);
    roomIds.push(room.id);
    expect(
      await database.db
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, room.id)),
    ).toHaveLength(0);
    expect(await listRooms(userIds[0], repo)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: room.id,
          participantCount: 0,
          isOwner: true,
        }),
      ]),
    );
    const invite = await createRoomInvite(
      userIds[0],
      room.id,
      { maxUses: 2 },
      repo,
      at,
    );
    await joinRoomInvite(userIds[0], invite.token, repo, at);
    await joinRoomInvite(userIds[1], invite.token, repo, at);
    expect(
      (await listRooms(userIds[0], repo)).filter((item) => item.id === room.id),
    ).toHaveLength(1);
    expect((await getRoom(userIds[1], room.id, repo)).participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: userIds[1], role: "MEMBER" }),
      ]),
    );
    const [storedInvite] = await database.db
      .select()
      .from(roomInvites)
      .where(eq(roomInvites.roomId, room.id));
    expect(storedInvite.usedCount).toBe(2);
  });

  it("allows only one of two concurrent joins to consume the final use", async () => {
    const repo = createRoomRepository(database.db);
    const room = await createRoom(userIds[0], { name: "One use" }, repo);
    roomIds.push(room.id);
    const invite = await createRoomInvite(
      userIds[0],
      room.id,
      { maxUses: 1 },
      repo,
      at,
    );
    const outcomes = await Promise.allSettled([
      joinRoomInvite(userIds[2], invite.token, repo, at),
      joinRoomInvite(userIds[3], invite.token, repo, at),
    ]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(outcomes.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
    expect(
      await database.db
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, room.id)),
    ).toHaveLength(1);
    const [storedInvite] = await database.db
      .select()
      .from(roomInvites)
      .where(eq(roomInvites.roomId, room.id));
    expect(storedInvite.usedCount).toBe(1);
  });
});
