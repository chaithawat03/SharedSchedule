"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CalendarMonth } from "../../types/calendar";

type Props = {
  roomId: string;
  dates: string[];
  statuses: CalendarMonth["statuses"];
  locations: CalendarMonth["locations"];
  onClose: () => void;
  onCreated: () => Promise<boolean>;
  onChoicesStale?: () => Promise<boolean>;
};

const inputClass =
  "mt-1 min-h-11 w-full rounded-xl border border-[#cddfd3] bg-white px-3 text-base text-[#18332f]";
const labelClass = "block text-sm font-semibold text-[#315647]";

export function BulkEventEditor({
  roomId,
  dates,
  statuses,
  locations,
  onClose,
  onCreated,
  onChoicesStale,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [endTimeOpen, setEndTimeOpen] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [locationText, setLocationText] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const [rejectedStatusId, setRejectedStatusId] = useState("");
  const [rejectedLocationId, setRejectedLocationId] = useState("");
  const selectedStatus = statuses.find((status) => status.id === statusId);
  const staleStatus = Boolean(
    statusId && (!selectedStatus || statusId === rejectedStatusId),
  );
  const staleLocation = Boolean(
    locationId &&
    (!locations.some((location) => location.id === locationId) ||
      locationId === rejectedLocationId),
  );

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);

  async function refresh() {
    try {
      if (!(await onCreated()))
        setError(
          "Events added, but the calendar could not refresh. Retry below.",
        );
    } catch {
      setError(
        "Events added, but the calendar could not refresh. Retry below.",
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || created) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${roomId}/events/bulk`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates,
          event: {
            statusId,
            allDay,
            title,
            startTime: allDay ? null : startTime,
            endTime: allDay ? null : endTime,
            endTimeOpen: allDay ? false : endTimeOpen,
            locationId: locationId || null,
            locationText: locationText || null,
            note,
          },
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as {
          error?: string;
          code?: string;
          conflictDates?: string[];
        };
        setError(
          result.conflictDates?.length
            ? `${result.error ?? "Matching events already exist"}: ${result.conflictDates.join(", ")}`
            : (result.error ?? "Unable to add events"),
        );
        if (
          result.code === "INVALID_INPUT" &&
          /active (status|location)/i.test(result.error ?? "")
        ) {
          if (/active status/i.test(result.error ?? ""))
            setRejectedStatusId(statusId);
          if (/active location/i.test(result.error ?? ""))
            setRejectedLocationId(locationId);
          try {
            await onChoicesStale?.();
          } catch {
            /* Keep the submitted fields and server error. */
          }
        }
        return;
      }
      setCreated(true);
      await refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function retryRefresh() {
    if (pending || !created) return;
    setPending(true);
    setError("");
    try {
      await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="bulk-event-heading"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-[#10221b]/50"
    >
      <div className="flex min-h-full items-end sm:items-center sm:justify-center">
        <section className="max-h-dvh min-h-dvh w-full overflow-y-auto bg-[#f6f8f5] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 text-[#18332f] shadow-2xl sm:min-h-0 sm:max-h-[90dvh] sm:max-w-xl sm:rounded-3xl">
          <form
            onSubmit={(event) => void submit(event)}
            className="flex min-h-[min(88dvh,700px)] flex-col"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#397c61]">
                  Bulk event
                </p>
                <h2
                  id="bulk-event-heading"
                  className="mt-1 text-xl font-semibold"
                >
                  Add to {dates.length} selected dates
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                aria-label="Close bulk event editor"
                className="min-h-11 min-w-11 rounded-full bg-[#e2eee5] text-xl"
              >
                ×
              </button>
            </div>
            <p className="mt-3 text-sm text-[#567269]">{dates.join(", ")}</p>
            <fieldset
              disabled={pending || created}
              className="mt-4 flex-1 space-y-4"
            >
              <label className={labelClass}>
                Status
                <select
                  required
                  className={inputClass}
                  value={statusId}
                  onChange={(event) => setStatusId(event.target.value)}
                >
                  {staleStatus && (
                    <option value={statusId} disabled>
                      Unavailable status (inactive)
                    </option>
                  )}
                  {!statusId && <option value="">Choose status</option>}
                  {statuses.map((status) => (
                    <option
                      key={status.id}
                      value={status.id}
                      disabled={status.id === rejectedStatusId}
                    >
                      {status.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedStatus?.code.toUpperCase() === "OFF" && (
                <p className="rounded-xl bg-[#e7efe8] p-3 text-sm text-[#315647]">
                  OFF is added as an event. Your base WORK schedule will still
                  appear on these dates.
                </p>
              )}
              <label className={labelClass}>
                Title
                <input
                  className={inputClass}
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-[#315647]">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(event) => setAllDay(event.target.checked)}
                  className="size-5"
                />
                All day
              </label>
              {!allDay && (
                <>
                  <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
                    <label className={labelClass}>
                      Start time
                      <input
                        className={inputClass}
                        type="time"
                        required
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                      />
                    </label>
                    <label className={labelClass}>
                      End time
                      <input
                        className={inputClass}
                        type="time"
                        required
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                      />
                    </label>
                  </div>
                  <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-[#315647]">
                    <input
                      type="checkbox"
                      checked={endTimeOpen}
                      onChange={(event) => setEndTimeOpen(event.target.checked)}
                      className="size-5"
                    />
                    End time +
                  </label>
                  <p className="text-xs text-[#567269]">
                    Each date gets its own single-day event. Use the individual
                    editor for overnight events.
                  </p>
                </>
              )}
              <label className={labelClass}>
                Master location
                <select
                  className={inputClass}
                  value={locationId}
                  onChange={(event) => {
                    setLocationId(event.target.value);
                    setLocationText("");
                  }}
                >
                  {staleLocation && (
                    <option value={locationId} disabled>
                      Unavailable location (inactive)
                    </option>
                  )}
                  <option value="">None or custom</option>
                  {locations.map((location) => (
                    <option
                      key={location.id}
                      value={location.id}
                      disabled={location.id === rejectedLocationId}
                    >
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Custom location
                <input
                  className={inputClass}
                  maxLength={200}
                  value={locationText}
                  onChange={(event) => {
                    setLocationText(event.target.value);
                    setLocationId("");
                  }}
                />
              </label>
              <label className={labelClass}>
                Note
                <textarea
                  className={`${inputClass} min-h-24 py-3`}
                  maxLength={10000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </fieldset>
            <p
              role="alert"
              aria-live="polite"
              className="mt-3 min-h-6 text-sm text-[#a02f25]"
            >
              {error}
            </p>
            <div className="sticky bottom-0 -mx-5 mt-2 bg-[#f6f8f5] px-5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3">
              {created ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void retryRefresh()}
                  className="min-h-11 w-full rounded-xl bg-[#205545] px-4 font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Refreshing…" : "Retry calendar refresh"}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    pending || !statusId || staleStatus || staleLocation
                  }
                  className="min-h-11 w-full rounded-xl bg-[#205545] px-4 font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Adding…" : "Add to selected dates"}
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </dialog>
  );
}
