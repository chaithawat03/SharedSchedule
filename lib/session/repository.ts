import { and, eq, lt } from "drizzle-orm";
import { createDatabase, getDatabase } from "../db";
import { sessions, users } from "../db/schema";
import type {
  NewUser,
  SessionRepository,
  SessionUser,
} from "../../services/session.service";

type Database = ReturnType<typeof createDatabase>["db"];

export function createSessionRepository(db: Database): SessionRepository {
  async function findUserByPhone(
    phoneNormalized: string,
  ): Promise<SessionUser | null> {
    const [user] = await db
      .select({
        id: users.id,
        phoneNormalized: users.phoneNormalized,
        phoneDisplay: users.phoneDisplay,
        displayName: users.displayName,
        status: users.status,
      })
      .from(users)
      .where(eq(users.phoneNormalized, phoneNormalized))
      .limit(1);
    return user ?? null;
  }

  return {
    findUserByPhone,

    async createUser(input: NewUser) {
      const [created] = await db
        .insert(users)
        .values(input)
        .onConflictDoNothing({ target: users.phoneNormalized })
        .returning({
          id: users.id,
          phoneNormalized: users.phoneNormalized,
          phoneDisplay: users.phoneDisplay,
          displayName: users.displayName,
          status: users.status,
        });
      if (created) return created;
      const existing = await findUserByPhone(input.phoneNormalized);
      if (!existing)
        throw new Error("User lookup failed after registration conflict");
      return existing;
    },

    async createSession(input) {
      await db.insert(sessions).values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
        lastActiveAt: input.createdAt,
      });
    },

    async findSessionByTokenHash(tokenHash) {
      const [row] = await db
        .select({
          id: sessions.id,
          status: sessions.status,
          expiresAt: sessions.expiresAt,
          lastActiveAt: sessions.lastActiveAt,
          userId: users.id,
          phoneNormalized: users.phoneNormalized,
          phoneDisplay: users.phoneDisplay,
          displayName: users.displayName,
          userStatus: users.status,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1);

      if (!row) return null;
      return {
        id: row.id,
        status: row.status,
        expiresAt: row.expiresAt,
        lastActiveAt: row.lastActiveAt,
        user: {
          id: row.userId,
          phoneNormalized: row.phoneNormalized,
          phoneDisplay: row.phoneDisplay,
          displayName: row.displayName,
          status: row.userStatus,
        },
      };
    },

    async touchSession(id, staleBefore, touchedAt) {
      await db
        .update(sessions)
        .set({ lastActiveAt: touchedAt })
        .where(
          and(
            eq(sessions.id, id),
            eq(sessions.status, "ACTIVE"),
            lt(sessions.lastActiveAt, staleBefore),
          ),
        );
    },

    async revokeSessionByTokenHash(tokenHash) {
      await db
        .update(sessions)
        .set({ status: "REVOKED" })
        .where(eq(sessions.tokenHash, tokenHash));
    },
  };
}

export function getSessionRepository(): SessionRepository {
  return createSessionRepository(getDatabase().db);
}
