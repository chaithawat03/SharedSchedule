"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarEvent, CalendarMonth } from "../../types/calendar";
import { EventForm } from "../events/EventForm";
import { calendarDateLabel } from "./CalendarDay";
import { MemberScheduleLane } from "./MemberScheduleLane";

export function DayDetailSheet({
  date,
  model,
  onClose,
  onMutated,
}: {
  date: string;
  model: CalendarMonth;
  onClose: () => void;
  onMutated?: () => Promise<boolean>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog?.open) dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!editing) closeButtonRef.current?.focus({ preventScroll: true });
  }, [editing]);

  const day = model.days[date];
  const canAdd = model.members.some(
    (member) => member.userId === model.currentUser.id,
  );
  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="day-detail-heading"
      onCancel={(event) => {
        event.preventDefault();
        if (editing) setEditing(null);
        else onClose();
      }}
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-[#10221b]/50"
    >
      <div
        className="flex min-h-full items-end sm:items-center sm:justify-center"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          className={`${editing ? "max-h-dvh min-h-dvh rounded-none sm:min-h-0 sm:max-h-[90dvh] sm:rounded-3xl" : "max-h-[88dvh] rounded-t-3xl sm:rounded-3xl"} w-full overflow-y-auto bg-[#f6f8f5] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 text-[#18332f] shadow-2xl sm:max-w-xl`}
        >
          {editing ? (
            <EventForm
              roomId={model.room.id}
              selectedDate={date}
              event={editing === "new" ? undefined : editing}
              statuses={model.statuses}
              locations={model.locations}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                const refreshed = (await onMutated?.()) ?? true;
                if (refreshed) setEditing(null);
                return refreshed;
              }}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#397c61]">
                    Day detail
                  </p>
                  <h2
                    id="day-detail-heading"
                    className="mt-1 text-xl font-semibold"
                  >
                    <time dateTime={date}>{calendarDateLabel(date)}</time>
                  </h2>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close day detail"
                  className="min-h-11 min-w-11 rounded-full bg-[#e2eee5] text-xl"
                >
                  ×
                </button>
              </div>
              <div className="mt-4">
                {model.members.length === 0 ? (
                  <p className="py-5 text-sm text-[#6c8476]">
                    No calendar participants yet.
                  </p>
                ) : (
                  model.members.map((member) => (
                    <MemberScheduleLane
                      key={member.userId}
                      member={member}
                      day={day.users[member.userId]}
                      currentUserId={model.currentUser.id}
                      onEditEvent={setEditing}
                    />
                  ))
                )}
              </div>
              {canAdd && (
                <button
                  type="button"
                  onClick={() => setEditing("new")}
                  className="mt-3 min-h-11 w-full rounded-xl bg-[#205545] px-4 font-semibold text-white"
                >
                  + Add my schedule
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </dialog>
  );
}
