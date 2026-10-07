import Link from "next/link";
import type { RoomSummary } from "../../services/room.service";
import { LogoutButton } from "../session/LogoutButton";
import { CreateRoomForm } from "./CreateRoomForm";

export function RoomListView({
  rooms,
  displayName,
}: {
  rooms: RoomSummary[];
  displayName: string;
}) {
  return (
    <main className="min-h-dvh bg-[#f6f8f5] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-[#18332f] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex min-h-11 items-center justify-between gap-3">
          <Link href="/rooms" className="text-lg font-semibold tracking-tight">
            SharedSchedule
          </Link>
          <span className="text-sm text-[#56716a]">{displayName}</span>
        </header>
        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#397c61]">
            Your shared spaces
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
            My Rooms
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#6c8476]">
            Open a room to see its participants or share an invite.
          </p>
        </div>
        <Link
          href="/work-calendar"
          className="mt-6 flex min-h-12 items-center justify-center rounded-xl border border-[#bfd4c6] bg-white px-4 font-semibold text-[#205545]"
        >
          Work calendar
        </Link>
        <div className="mt-8 grid gap-3" aria-label="Rooms">
          {rooms.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#cbded2] bg-white p-6">
              <h2 className="text-lg font-semibold">No rooms yet</h2>
              <p className="mt-2 text-sm leading-6 text-[#6c8476]">
                Create a room to begin sharing plans.
              </p>
            </div>
          ) : (
            rooms.map((room) => (
              <Link
                key={room.id}
                href={`/room/${room.id}`}
                className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-[#dce8e0] bg-white p-5 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287466]"
              >
                <span className="min-w-0">
                  <span className="block break-words text-lg font-semibold">
                    {room.name}
                  </span>
                  <span className="mt-1 block text-sm text-[#6c8476]">
                    {room.participantCount}{" "}
                    {room.participantCount === 1
                      ? "participant"
                      : "participants"}
                    {room.isOwner ? " · Owner" : ""}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xl text-[#397c61]"
                >
                  →
                </span>
              </Link>
            ))
          )}
        </div>
        <div className="mt-8">
          <CreateRoomForm />
        </div>
        <div className="mt-8 max-w-xs">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
