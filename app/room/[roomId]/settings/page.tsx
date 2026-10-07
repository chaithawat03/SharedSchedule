import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { RoomMastersSettings } from "../../../../components/rooms/RoomMastersSettings";
import { getMasterRepository } from "../../../../lib/master-data/repository";
import { SESSION_COOKIE_NAME } from "../../../../lib/session/cookie";
import { getSessionRepository } from "../../../../lib/session/repository";
import {
  assertMasterOwner,
  listLocations,
  listStatuses,
  MasterError,
} from "../../../../services/master-data.service";
import { resolveSession } from "../../../../services/session.service";

async function loadRoomMasters(userId: string, roomId: string) {
  const repo = getMasterRepository();
  try {
    const canonicalRoomId = await assertMasterOwner(userId, roomId, repo);
    const [statuses, locations] = await Promise.all([
      listStatuses(userId, canonicalRoomId, true, repo),
      listLocations(userId, canonicalRoomId, true, repo),
    ]);
    return {
      roomId: canonicalRoomId,
      initialStatuses: statuses.map(
        ({ id, code, name, icon, color, sortOrder, active }) => ({
          id,
          code,
          name,
          icon,
          color,
          sortOrder,
          active,
        }),
      ),
      initialLocations: locations.map(({ id, name, active }) => ({
        id,
        name,
        active,
      })),
    };
  } catch (error) {
    if (
      error instanceof MasterError &&
      (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
    )
      notFound();
    throw error;
  }
}

export default async function RoomSettingsPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const user = await resolveSession(token, getSessionRepository());
  if (!user) redirect("/");
  const props = await loadRoomMasters(user.id, roomId);
  return <RoomMastersSettings {...props} />;
}
