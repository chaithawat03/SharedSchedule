import { SESSION_DURATION_SECONDS } from "./token";

export const SESSION_COOKIE_NAME = "sharedschedule_session";

export function sessionCookieOptions(expiresAt: Date, production: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: production,
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DURATION_SECONDS,
  };
}
