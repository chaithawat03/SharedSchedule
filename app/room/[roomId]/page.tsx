import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { RoomDetailView } from "../../../components/rooms/RoomDetailView";
import { getRoomRepository } from "../../../lib/rooms/repository";
import { SESSION_COOKIE_NAME } from "../../../lib/session/cookie";
import { getSessionRepository } from "../../../lib/session/repository";
import { getRoom, RoomError } from "../../../services/room.service";
import { resolveSession } from "../../../services/session.service";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const user = await resolveSession(token, getSessionRepository());
  if (!user) redirect("/");
  let room;
  try {
    room = await getRoom(user.id, roomId, getRoomRepository());
  } catch (error) {
    if (error instanceof RoomError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  return <RoomDetailView room={room} isOwner={room.ownerUserId === user.id} />;
}
