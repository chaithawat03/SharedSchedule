import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { RoomDetailView } from "../../../components/rooms/RoomDetailView";
import { bangkokToday } from "../../../lib/calendar/date";
import { getCalendarRepository } from "../../../lib/calendar/repository";
import { SESSION_COOKIE_NAME } from "../../../lib/session/cookie";
import { getSessionRepository } from "../../../lib/session/repository";
import {
  CalendarError,
  getCalendarMonth,
} from "../../../services/calendar.service";
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
  const now = new Date();
  const [year, month] = bangkokToday(now).split("-").map(Number);
  let calendar;
  try {
    calendar = await getCalendarMonth(
      user,
      roomId,
      year,
      month,
      getCalendarRepository(),
      now,
    );
  } catch (error) {
    if (error instanceof CalendarError && error.code === "NOT_FOUND")
      notFound();
    throw error;
  }
  const room = {
    ...calendar.room,
    participants: calendar.members.map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
    })),
  };
  return (
    <RoomDetailView
      room={room}
      isOwner={room.ownerUserId === user.id}
      calendar={calendar}
    />
  );
}
