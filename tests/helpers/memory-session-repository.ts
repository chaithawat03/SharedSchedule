import { randomUUID } from "node:crypto";
import type {
  NewSession,
  NewUser,
  SessionRepository,
  SessionUser,
  StoredSession,
} from "../../services/session.service";

export class MemorySessionRepository implements SessionRepository {
  users = new Map<string, SessionUser>();
  sessions = new Map<string, StoredSession>();
  touchCount = 0;

  async findUserByPhone(phoneNormalized: string) {
    return this.users.get(phoneNormalized) ?? null;
  }

  async createUser(input: NewUser) {
    const existing = this.users.get(input.phoneNormalized);
    if (existing) return existing;
    const user = { id: randomUUID(), status: "ACTIVE", ...input };
    this.users.set(input.phoneNormalized, user);
    return user;
  }

  async createSession(input: NewSession) {
    const user = [...this.users.values()].find(
      (item) => item.id === input.userId,
    );
    if (!user) throw new Error("Test user missing");
    this.sessions.set(input.tokenHash, {
      id: randomUUID(),
      user,
      status: "ACTIVE",
      expiresAt: input.expiresAt,
      lastActiveAt: input.createdAt,
    });
  }

  async findSessionByTokenHash(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null;
  }

  async touchSession(id: string, staleBefore: Date, touchedAt: Date) {
    const session = [...this.sessions.values()].find((item) => item.id === id);
    if (session && session.lastActiveAt < staleBefore) {
      session.lastActiveAt = touchedAt;
      this.touchCount++;
    }
  }

  async revokeSessionByTokenHash(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    if (session) session.status = "REVOKED";
  }
}
