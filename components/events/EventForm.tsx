"use client";

import { useState, type FormEvent } from "react";
import type { CalendarEvent, CalendarMonth } from "../../types/calendar";

type FormState = {
  statusId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  endTimeOpen: boolean;
  locationId: string;
  locationText: string;
  note: string;
};

export function initialEventForm(
  selectedDate: string,
  event?: CalendarEvent,
): FormState {
  return {
    statusId: event?.statusId ?? "",
    title: event?.title ?? "",
    startDate: event?.startDate ?? selectedDate,
    endDate: event?.endDate ?? selectedDate,
    allDay: event?.allDay ?? true,
    startTime: event?.startTime ?? "",
    endTime: event?.endTime ?? "",
    endTimeOpen: event?.endTimeOpen ?? false,
    locationId: event?.locationId ?? "",
    locationText: event?.locationText ?? "",
    note: event?.note ?? "",
  };
}

type Props = {
  roomId: string;
  selectedDate: string;
  event?: CalendarEvent;
  statuses: CalendarMonth["statuses"];
  locations: CalendarMonth["locations"];
  onCancel: () => void;
  onSaved: () => Promise<boolean>;
};

const inputClass =
  "mt-1 min-h-11 w-full rounded-xl border border-[#cddfd3] bg-white px-3 text-base text-[#18332f]";
const labelClass = "block text-sm font-semibold text-[#315647]";

export function EventForm({
  roomId,
  selectedDate,
  event,
  statuses,
  locations,
  onCancel,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(() => {
    const initial = initialEventForm(selectedDate, event);
    return { ...initial, statusId: initial.statusId || statuses[0]?.id || "" };
  });
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const activeStatusIds = new Set(statuses.map((status) => status.id));
  const activeLocationIds = new Set(locations.map((location) => location.id));

  async function refreshSavedEvent() {
    try {
      if (!(await onSaved()))
        setError(
          "Event changed, but the calendar could not refresh. Retry below.",
        );
    } catch {
      setError(
        "Event changed, but the calendar could not refresh. Retry below.",
      );
    }
  }

  async function retryRefresh() {
    if (pending || !saved) return;
    setPending(true);
    setError("");
    try {
      await refreshSavedEvent();
    } finally {
      setPending(false);
    }
  }

  async function mutate(method: "POST" | "PATCH" | "DELETE") {
    if (pending || saved) return;
    setPending(true);
    setError("");
    try {
      const url =
        method === "POST"
          ? `/api/rooms/${roomId}/events`
          : `/api/events/${event?.eventId}`;
      const body =
        method === "DELETE"
          ? undefined
          : JSON.stringify({
              statusId: form.statusId,
              title: form.title,
              startDate: form.startDate,
              endDate: form.endDate,
              allDay: form.allDay,
              startTime: form.allDay ? null : form.startTime,
              endTime: form.allDay ? null : form.endTime,
              endTimeOpen: form.allDay ? false : form.endTimeOpen,
              locationId: form.locationId || null,
              locationText: form.locationText || null,
              note: form.note,
            });
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "Unable to save event");
        return;
      }
      setSaved(true);
      await refreshSavedEvent();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function submit(eventObject: FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    void mutate(event ? "PATCH" : "POST");
  }

  return (
    <form onSubmit={submit} className="flex min-h-[min(88dvh,700px)] flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 id="day-detail-heading" className="text-xl font-semibold">
          {event ? "Edit my event" : "Add my schedule"}
        </h2>
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          disabled={pending}
          aria-label="Close event form"
          className="min-h-11 min-w-11 rounded-full bg-[#e2eee5] text-xl"
        >
          ×
        </button>
      </div>
      <fieldset disabled={pending || saved} className="mt-4 flex-1 space-y-4">
        <label className={labelClass}>
          Status
          <select
            required
            className={inputClass}
            value={form.statusId}
            onChange={(e) => set("statusId", e.target.value)}
          >
            {!activeStatusIds.has(form.statusId) && form.statusId && (
              <option value={form.statusId}>
                {event?.statusName ?? "Previous status"} (inactive)
              </option>
            )}
            {!form.statusId && <option value="">Choose status</option>}
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Title
          <input
            className={inputClass}
            maxLength={200}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
          <label className={labelClass}>
            Start date
            <input
              className={inputClass}
              type="date"
              required
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </label>
          <label className={labelClass}>
            End date
            <input
              className={inputClass}
              type="date"
              required
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-[#315647]">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(e) => set("allDay", e.target.checked)}
            className="size-5"
          />{" "}
          All day
        </label>
        {!form.allDay && (
          <>
            <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
              <label className={labelClass}>
                Start time
                <input
                  className={inputClass}
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                End time
                <input
                  className={inputClass}
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                />
              </label>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-[#315647]">
              <input
                type="checkbox"
                checked={form.endTimeOpen}
                onChange={(e) => set("endTimeOpen", e.target.checked)}
                className="size-5"
              />{" "}
              End time +
            </label>
          </>
        )}
        <label className={labelClass}>
          Master location
          <select
            className={inputClass}
            value={form.locationId}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                locationId: e.target.value,
                locationText: "",
              }))
            }
          >
            <option value="">None or custom</option>
            {!activeLocationIds.has(form.locationId) && form.locationId && (
              <option value={form.locationId}>
                {event?.locationName ?? "Previous location"} (inactive)
              </option>
            )}
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
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
            value={form.locationText}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                locationText: e.target.value,
                locationId: "",
              }))
            }
          />
        </label>
        <label className={labelClass}>
          Note
          <textarea
            className={`${inputClass} min-h-24 py-3`}
            maxLength={10000}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
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
      <div className="sticky bottom-0 -mx-5 mt-2 space-y-2 bg-[#f6f8f5] px-5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3">
        {saved ? (
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
            disabled={pending || !form.statusId}
            className="min-h-11 w-full rounded-xl bg-[#205545] px-4 font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save event"}
          </button>
        )}
        {event && !saved && !confirmDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
            className="min-h-11 w-full rounded-xl text-[#a02f25]"
          >
            Delete my event
          </button>
        )}
        {event && !saved && confirmDelete && (
          <div className="rounded-xl border border-[#edc9c5] p-3">
            <p className="text-sm">Delete this event?</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
                className="min-h-11 flex-1 rounded-xl bg-white"
              >
                Keep event
              </button>
              <button
                type="button"
                onClick={() => void mutate("DELETE")}
                disabled={pending}
                className="min-h-11 flex-1 rounded-xl bg-[#a02f25] text-white"
              >
                Confirm delete
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
