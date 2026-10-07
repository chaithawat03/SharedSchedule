"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { shiftMonth, weekdayMondayFirst } from "../../lib/calendar/date";
import type { PatternDay } from "../../lib/work-schedule/validation";

type Exception = {
  id: string;
  date: string;
  type: "WORK" | "OFF";
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};
type ExceptionDraft = {
  id?: string;
  date: string;
  type: "WORK" | "OFF";
  startTime: string;
  endTime: string;
  note: string;
};

const names = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const field =
  "min-h-11 w-full rounded-xl border border-[#bfd4c6] bg-white px-3 text-base text-[#18332f]";

async function responseJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data?.error || "Work calendar request failed");
  return data as T;
}

export function WorkCalendarEditor({
  initialYear,
  initialMonth,
  standalone = false,
  onClose,
  onChanged,
}: {
  initialYear: number;
  initialMonth: number;
  standalone?: boolean;
  onClose?: () => void;
  onChanged?: () => Promise<boolean>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [days, setDays] = useState<PatternDay[] | null>(null);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [month, setMonth] = useState({
    year: initialYear,
    month: initialMonth,
  });
  const [draft, setDraft] = useState<ExceptionDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshPending, setRefreshPending] = useState(false);

  useEffect(() => {
    if (standalone) return;
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, [standalone]);

  useEffect(() => {
    let active = true;
    Promise.all([
      responseJson<{ days: PatternDay[] }>("/api/me/work-pattern"),
      responseJson<{ overrides: Exception[] }>(
        `/api/me/work-overrides?year=${month.year}&month=${month.month}`,
      ),
    ])
      .then(([pattern, overrides]) => {
        if (!active) return;
        setDays(pattern.days);
        setExceptions(overrides.overrides);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load work calendar",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month.year, month.month]);

  function changeDay(weekday: number, values: Partial<PatternDay>) {
    setDays(
      (current) =>
        current?.map((day) =>
          day.weekday === weekday ? { ...day, ...values } : day,
        ) ?? null,
    );
  }

  function chooseMonth(year: number, selectedMonth: number) {
    if (year < 1 || year > 9999 || selectedMonth < 1 || selectedMonth > 12)
      return;
    if (year === month.year && selectedMonth === month.month) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    setExceptions([]);
    setMonth({ year, month: selectedMonth });
  }

  async function refreshRoom() {
    if (!onChanged) return;
    const refreshed = await onChanged();
    setRefreshPending(!refreshed);
    if (!refreshed)
      setError("Work calendar saved, but the room calendar could not refresh.");
    else setError(null);
  }

  async function saveWeek(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!days || pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await responseJson<{ days: PatternDay[] }>(
        "/api/me/work-pattern",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            days: days.map((day) =>
              day.state === "WORK"
                ? day
                : { ...day, startTime: null, endTime: null },
            ),
          }),
        },
      );
      setDays(saved.days);
      setMessage("Weekly pattern saved.");
      await refreshRoom();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save weekly pattern",
      );
    } finally {
      setPending(false);
    }
  }

  function suggestedTimes(date: string) {
    const pattern = days?.find(
      (day) => day.weekday === weekdayMondayFirst(date),
    );
    return pattern?.state === "WORK"
      ? { startTime: pattern.startTime ?? "", endTime: pattern.endTime ?? "" }
      : { startTime: "", endTime: "" };
  }

  function startAdd() {
    setError(null);
    setMessage(null);
    setDraft({
      date: `${month.year}-${String(month.month).padStart(2, "0")}-01`,
      type: "OFF",
      startTime: "",
      endTime: "",
      note: "",
    });
  }

  function startEdit(value: Exception) {
    setError(null);
    setMessage(null);
    setDraft({
      id: value.id,
      date: value.date,
      type: value.type,
      startTime: value.startTime ?? "",
      endTime: value.endTime ?? "",
      note: value.note ?? "",
    });
  }

  async function saveException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const editing = Boolean(draft.id);
    const body = {
      ...(!editing ? { date: draft.date } : {}),
      type: draft.type,
      startTime: draft.type === "WORK" ? draft.startTime : null,
      endTime: draft.type === "WORK" ? draft.endTime : null,
      note: draft.note,
    };
    try {
      const result = await responseJson<{ override: Exception }>(
        editing
          ? `/api/me/work-overrides/${draft.id}`
          : "/api/me/work-overrides",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setExceptions((current) =>
        [
          ...current.filter((row) => row.id !== result.override.id),
          result.override,
        ].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setDraft(null);
      setMessage("Exception saved.");
      await refreshRoom();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save exception",
      );
    } finally {
      setPending(false);
    }
  }

  async function removeException(value: Exception) {
    if (pending || !window.confirm(`Delete the exception for ${value.date}?`))
      return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await responseJson(`/api/me/work-overrides/${value.id}`, {
        method: "DELETE",
      });
      setExceptions((current) => current.filter((row) => row.id !== value.id));
      setMessage("Exception deleted. The weekly pattern now applies.");
      await refreshRoom();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to delete exception",
      );
    } finally {
      setPending(false);
    }
  }

  const contents = (
    <div className="mx-auto max-w-2xl px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5 text-[#18332f] sm:px-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#397c61]">
            Personal schedule
          </p>
          <h1
            id="work-calendar-heading"
            className="mt-1 text-2xl font-semibold"
          >
            Work calendar
          </h1>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close work calendar"
            className="min-h-11 min-w-11 rounded-full bg-[#e2eee5] text-xl"
          >
            ×
          </button>
        )}
      </header>
      <p className="mt-3 rounded-xl bg-[#e7efe8] p-3 text-sm leading-6 text-[#315647]">
        Your work calendar is personal and applies to every room you join.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-[#fff0ec] p-3 text-sm text-[#a02f25]"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-[#276451]">
          {message}
        </p>
      )}
      {refreshPending && (
        <button
          type="button"
          onClick={() => void refreshRoom()}
          className="mt-3 min-h-11 rounded-xl bg-[#205545] px-4 font-semibold text-white"
        >
          Retry calendar refresh
        </button>
      )}
      {loading && (
        <p role="status" className="mt-5">
          Loading work calendar…
        </p>
      )}
      {days && !loading && (
        <form onSubmit={(event) => void saveWeek(event)} className="mt-6">
          <h2 className="text-xl font-semibold">Default weekly schedule</h2>
          <div className="mt-3 space-y-3">
            {days.map((day) => (
              <fieldset
                key={day.weekday}
                aria-label={names[day.weekday - 1]}
                className="rounded-2xl border border-[#dce8e0] bg-white p-4"
              >
                <legend className="font-semibold">
                  {names[day.weekday - 1]}
                </legend>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="min-w-36 flex-1 text-sm">
                    Schedule
                    <select
                      aria-label={`${names[day.weekday - 1]} schedule`}
                      value={day.state}
                      disabled={pending}
                      onChange={(event) =>
                        changeDay(day.weekday, {
                          state: event.target.value as PatternDay["state"],
                          startTime: null,
                          endTime: null,
                        })
                      }
                      className={`${field} mt-1`}
                    >
                      <option value="NONE">No default</option>
                      <option value="WORK">Work</option>
                      <option value="OFF">Off</option>
                    </select>
                  </label>
                </div>
                {day.state === "WORK" && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-sm">
                      Start time
                      <input
                        type="time"
                        required
                        value={day.startTime ?? ""}
                        disabled={pending}
                        onChange={(event) =>
                          changeDay(day.weekday, {
                            startTime: event.target.value,
                          })
                        }
                        className={`${field} mt-1`}
                      />
                    </label>
                    <label className="text-sm">
                      End time
                      <input
                        type="time"
                        required
                        value={day.endTime ?? ""}
                        disabled={pending}
                        onChange={(event) =>
                          changeDay(day.weekday, {
                            endTime: event.target.value,
                          })
                        }
                        className={`${field} mt-1`}
                      />
                    </label>
                  </div>
                )}
              </fieldset>
            ))}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 min-h-11 w-full rounded-xl bg-[#205545] px-4 font-semibold text-white disabled:opacity-50"
          >
            Save weekly pattern
          </button>
        </form>
      )}
      <section
        className="mt-9 border-t border-[#dce8e0] pt-7"
        aria-label="Monthly exceptions"
      >
        <h2 className="text-xl font-semibold">Exceptions</h2>
        <p className="mt-1 text-sm text-[#567269]">
          An exception changes your base schedule for one date. Room events stay
          separate.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Previous exception month"
            onClick={() => {
              const selected = shiftMonth(month.year, month.month, -1);
              chooseMonth(selected.year, selected.month);
            }}
            className="min-h-11 min-w-11 rounded-xl bg-white"
          >
            ‹
          </button>
          <label className="min-w-44 flex-1 text-sm">
            Exception month
            <input
              type="month"
              aria-label="Exception month"
              value={`${String(month.year).padStart(4, "0")}-${String(month.month).padStart(2, "0")}`}
              onChange={(event) => {
                const [year, selected] = event.target.value
                  .split("-")
                  .map(Number);
                chooseMonth(year, selected);
              }}
              className={`${field} mt-1`}
            />
          </label>
          <button
            type="button"
            aria-label="Next exception month"
            onClick={() => {
              const selected = shiftMonth(month.year, month.month, 1);
              chooseMonth(selected.year, selected.month);
            }}
            className="min-h-11 min-w-11 rounded-xl bg-white"
          >
            ›
          </button>
        </div>
        <p className="mt-2 text-sm text-[#567269]">
          {months[month.month - 1]} {month.year}
        </p>
        <button
          type="button"
          onClick={startAdd}
          disabled={!days || pending}
          className="mt-4 min-h-11 w-full rounded-xl bg-[#205545] px-4 font-semibold text-white disabled:opacity-50"
        >
          Add exception
        </button>
        {exceptions.length === 0 && !loading && (
          <p className="mt-4 text-sm text-[#6c8476]">
            No exceptions this month.
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {exceptions.map((value) => (
            <li
              key={value.id}
              className="rounded-2xl border border-[#dce8e0] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <time dateTime={value.date} className="font-semibold">
                    {value.date}
                  </time>
                  <p className="mt-1 text-sm">
                    {value.type === "WORK"
                      ? `Work ${value.startTime}–${value.endTime}`
                      : "Off"}
                  </p>
                  {value.note && (
                    <p className="mt-1 break-words text-sm text-[#567269]">
                      {value.note}
                    </p>
                  )}
                </div>
                <span className="text-xs text-[#397c61]">Date override</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  aria-label={`Edit exception ${value.date}`}
                  onClick={() => startEdit(value)}
                  className="min-h-11 rounded-xl border border-[#bfd4c6] px-4"
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Delete exception ${value.date}`}
                  onClick={() => void removeException(value)}
                  className="min-h-11 rounded-xl border border-[#e1bdb8] px-4 text-[#a02f25]"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {draft && (
        <form
          onSubmit={(event) => void saveException(event)}
          className="mt-6 rounded-2xl border border-[#bfd4c6] bg-white p-4"
          aria-label="Exception for this date"
        >
          <h3 className="text-lg font-semibold">Exception for this date</h3>
          {draft.id ? (
            <p className="mt-2 text-sm">
              Date: <time dateTime={draft.date}>{draft.date}</time>
            </p>
          ) : (
            <label className="mt-3 block text-sm">
              Exception date
              <input
                type="date"
                required
                min={`${month.year}-${String(month.month).padStart(2, "0")}-01`}
                max={`${month.year}-${String(month.month).padStart(2, "0")}-31`}
                value={draft.date}
                onChange={(event) => {
                  const date = event.target.value;
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          date,
                          ...(current.type === "WORK" && date
                            ? suggestedTimes(date)
                            : {}),
                        }
                      : null,
                  );
                }}
                className={`${field} mt-1`}
              />
            </label>
          )}
          <label className="mt-3 block text-sm">
            Exception type
            <select
              value={draft.type}
              onChange={(event) => {
                const type = event.target.value as "WORK" | "OFF";
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        type,
                        ...(type === "WORK"
                          ? suggestedTimes(current.date)
                          : { startTime: "", endTime: "" }),
                      }
                    : null,
                );
              }}
              className={`${field} mt-1`}
            >
              <option value="OFF">Off</option>
              <option value="WORK">Work</option>
            </select>
          </label>
          {draft.type === "WORK" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm">
                Start time
                <input
                  type="time"
                  required
                  value={draft.startTime}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, startTime: event.target.value }
                        : null,
                    )
                  }
                  className={`${field} mt-1`}
                />
              </label>
              <label className="text-sm">
                End time
                <input
                  type="time"
                  required
                  value={draft.endTime}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, endTime: event.target.value }
                        : null,
                    )
                  }
                  className={`${field} mt-1`}
                />
              </label>
            </div>
          )}
          <label className="mt-3 block text-sm">
            Exception note
            <textarea
              maxLength={10000}
              value={draft.note}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, note: event.target.value } : null,
                )
              }
              className={`${field} mt-1 min-h-20 py-2`}
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="min-h-11 flex-1 rounded-xl border border-[#bfd4c6]"
            >
              Cancel exception
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 flex-1 rounded-xl bg-[#205545] font-semibold text-white disabled:opacity-50"
            >
              Save exception
            </button>
          </div>
        </form>
      )}
    </div>
  );

  if (standalone) return <div>{contents}</div>;
  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="work-calendar-heading"
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none overflow-y-auto bg-[#f6f8f5] p-0 backdrop:bg-[#10221b]/50"
    >
      {contents}
    </dialog>
  );
}
