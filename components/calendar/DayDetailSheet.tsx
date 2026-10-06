"use client";

import { useEffect, useRef } from "react";
import type { CalendarMonth } from "../../types/calendar";
import { calendarDateLabel } from "./CalendarDay";
import { MemberScheduleLane } from "./MemberScheduleLane";

export function DayDetailSheet({
  date,
  model,
  onClose,
}: {
  date: string;
  model: CalendarMonth;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  const day = model.days[date];
  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="day-detail-heading"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-[#10221b]/50"
    >
      <div
        className="flex min-h-full items-end sm:items-center sm:justify-center"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-[#f6f8f5] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 text-[#18332f] shadow-2xl sm:max-w-xl sm:rounded-3xl">
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
                />
              ))
            )}
          </div>
        </section>
      </div>
    </dialog>
  );
}
