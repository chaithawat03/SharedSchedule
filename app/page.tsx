import { cookies } from "next/headers";
import { IdentityShell } from "./identity-shell";
import { SESSION_COOKIE_NAME } from "../lib/session/cookie";
import { isSessionToken } from "../lib/session/token";
import { getSessionRepository } from "../lib/session/repository";
import { resolveSession } from "../services/session.service";

export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const user = isSessionToken(token)
    ? await resolveSession(token, getSessionRepository())
    : null;
  return <IdentityShell user={user} />;
}
