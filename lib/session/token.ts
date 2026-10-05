import { createHash, randomBytes } from "node:crypto";

export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isSessionToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function sessionExpiresAt(now: Date): Date {
  return new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);
}
