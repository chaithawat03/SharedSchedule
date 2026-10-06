import { cookies } from "next/headers";
import { InviteView } from "../../../components/rooms/InviteView";
import { getRoomRepository } from "../../../lib/rooms/repository";
import { SESSION_COOKIE_NAME } from "../../../lib/session/cookie";
import { getSessionRepository } from "../../../lib/session/repository";
import { inspectInvite } from "../../../services/room.service";
import { resolveSession } from "../../../services/session.service";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const user = await resolveSession(sessionToken, getSessionRepository());
  const state = await inspectInvite(token, getRoomRepository());
  return <InviteView token={token} state={state} user={user} />;
}
