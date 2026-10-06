import Link from "next/link";
import type { PublicSessionUser } from "../../services/session.service";
import type { InviteState } from "../../services/room.service";
import { PhoneIdentityForm } from "../session/PhoneIdentityForm";
import { InviteJoiner } from "./InviteJoiner";

export function InviteView({
  token,
  state,
  user,
}: {
  token: string;
  state: InviteState;
  user: PublicSessionUser | null;
}) {
  const usable = state.kind === "valid";
  const message =
    state.kind === "expired"
      ? "This invite has expired."
      : state.kind === "exhausted"
        ? "This invite has reached its usage limit."
        : "This invite link is invalid.";
  return (
    <main className="min-h-dvh bg-[#f6f8f5] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-[#18332f] sm:px-8">
      <div className="mx-auto max-w-xl">
        <header className="flex min-h-11 items-center">
          <Link href="/" className="text-lg font-semibold">
            SharedSchedule
          </Link>
        </header>
        <div className="mt-10 rounded-3xl border border-[#dce8e0] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#397c61]">
            Room invitation
          </p>
          {usable && (
            <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight">
              Join {state.roomName}
            </h1>
          )}
          {!usable && !user ? (
            <>
              <h1 className="mt-3 text-3xl font-semibold">
                Invite unavailable
              </h1>
              <p className="mt-4 text-sm leading-6 text-[#6c8476]">{message}</p>
              {state.kind === "invalid" ? (
                <Link
                  href="/rooms"
                  className="mt-6 inline-flex min-h-11 items-center font-semibold text-[#397c61]"
                >
                  Go to my rooms
                </Link>
              ) : (
                <>
                  <p className="mt-4 text-sm leading-6 text-[#6c8476]">
                    If you already joined, sign in to open the room.
                  </p>
                  <div className="mt-6">
                    <PhoneIdentityForm />
                  </div>
                </>
              )}
            </>
          ) : null}
          {usable && !user && (
            <>
              <p className="mt-4 text-sm leading-6 text-[#6c8476]">
                Continue with your phone number to join this room.
              </p>
              <div className="mt-6">
                <PhoneIdentityForm />
              </div>
            </>
          )}
          {user && state.kind !== "invalid" && (
            <div className="mt-6">
              <InviteJoiner
                token={token}
                roomName={usable ? state.roomName : undefined}
              />
            </div>
          )}
          {user && state.kind === "invalid" && (
            <p className="mt-4 text-sm leading-6 text-[#6c8476]">{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}
