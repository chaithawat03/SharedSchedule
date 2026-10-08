import Link from "next/link";
import type {
  RoomDetail,
  RoomParticipant,
  RoomRecord,
} from "../../services/room.service";
import type { CalendarMonth } from "../../types/calendar";
import { MonthCalendar } from "../calendar/MonthCalendar";
import { InviteControl } from "./InviteControl";
import { JoinParticipantButton } from "./JoinParticipantButton";
import { AppNavigation } from "../navigation/AppNavigation";

export function RoomDetailView({
  room,
  isOwner,
  calendar,
}: {
  room:
    | RoomDetail
    | (RoomRecord & {
        participants: Pick<RoomParticipant, "userId" | "displayName">[];
      });
  isOwner: boolean;
  calendar?: CalendarMonth;
}) {
  return (
    <main className="min-h-dvh bg-[#f6f8f5] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-[#18332f] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex min-h-11 items-center">
          <Link
            href="/rooms"
            className="flex min-h-11 items-center text-sm font-semibold text-[#397c61]"
          >
            ← My Rooms
          </Link>
        </header>
        <AppNavigation current="room" roomId={room.id} isOwner={isOwner} />
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#397c61]">
            {isOwner ? "Your room" : "Shared room"}
          </p>
          <h1 className="mt-2 break-words text-4xl font-semibold tracking-[-0.05em]">
            {room.name}
          </h1>
          {room.description && (
            <p className="mt-3 text-sm text-[#6c8476]">{room.description}</p>
          )}
        </div>
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-6">
          <div className="min-w-0">
            {calendar && (
              <div className="-mx-5 mt-8 sm:mx-0">
                <MonthCalendar initialModel={calendar} />
              </div>
            )}
          </div>
          <div className="min-w-0 lg:mt-3">
            <section
              className="mt-5 rounded-3xl border border-[#dce8e0] bg-white p-5 sm:p-6"
              aria-labelledby="participants-heading"
            >
              <h2 id="participants-heading" className="text-xl font-semibold">
                Participants
              </h2>
              {room.participants.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-[#6c8476]">
                  No participants yet. The room owner can join here or share an
                  invite.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {room.participants.map((participant) => (
                    <li
                      key={participant.userId}
                      className="flex min-h-12 items-center gap-3 rounded-xl bg-[#f4f8f3] px-4 py-2"
                    >
                      <span
                        className="grid size-8 place-items-center rounded-full bg-[#dcefe1] font-semibold text-[#276451]"
                        aria-hidden="true"
                      >
                        {participant.displayName.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium">
                        {participant.displayName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {isOwner &&
                !room.participants.some(
                  (participant) => participant.userId === room.ownerUserId,
                ) && <JoinParticipantButton roomId={room.id} />}
            </section>
            {isOwner && (
              <div className="mt-5 space-y-4">
                <Link
                  href={`/room/${room.id}/settings`}
                  prefetch={false}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-[#bfd4c6] bg-white px-4 font-semibold text-[#205545]"
                >
                  Room settings
                </Link>
                <InviteControl roomId={room.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
