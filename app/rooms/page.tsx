import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RoomListView } from "../../components/rooms/RoomListView";
import { getRoomRepository } from "../../lib/rooms/repository";
import { SESSION_COOKIE_NAME } from "../../lib/session/cookie";
import { getSessionRepository } from "../../lib/session/repository";
import { resolveSession } from "../../services/session.service";
import { listRooms } from "../../services/room.service";

export default async function RoomsPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const user = await resolveSession(token, getSessionRepository());
  if (!user) redirect("/");
  const rooms = await listRooms(user.id, getRoomRepository());
  return <RoomListView rooms={rooms} displayName={user.displayName} />;
}
