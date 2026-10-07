"use client";

import { useState } from "react";
import { shiftMonth, weekdayMondayFirst } from "../../lib/calendar/date";
import type { CalendarMonth } from "../../types/calendar";
import { CalendarDay } from "./CalendarDay";
import { DayDetailSheet } from "./DayDetailSheet";
import { BulkEventEditor } from "../events/BulkEventEditor";
import { WorkCalendarEditor } from "../work-schedule/WorkCalendarEditor";

const monthNames = [
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
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type CalendarView = { source: CalendarMonth; model: CalendarMonth };

export function visibleCalendarModel(
  view: CalendarView,
  initialModel: CalendarMonth,
) {
  return view.source === initialModel ? view.model : initialModel;
}

export async function loadAdjacentCalendarMonth(
  model: CalendarMonth,
  delta: number,
  request: typeof fetch = fetch,
): Promise<CalendarMonth> {
  const target = shiftMonth(model.year, model.month, delta);
  const response = await request(
    `/api/rooms/${model.room.id}/calendar?year=${target.year}&month=${target.month}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Unable to load that month. Try again.");
  return (await response.json()) as CalendarMonth;
}

export async function reloadDisplayedCalendarMonth(
  model: CalendarMonth,
  request: typeof fetch = fetch,
): Promise<CalendarMonth> {
  const response = await request(
    `/api/rooms/${model.room.id}/calendar?year=${model.year}&month=${model.month}`,
    { cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      "Event saved, but the calendar could not refresh. Try changing months.",
    );
  return (await response.json()) as CalendarMonth;
}

export function MonthCalendar({
  initialModel,
}: {
  initialModel: CalendarMonth;
}) {
  const [view, setView] = useState<CalendarView>({
    source: initialModel,
    model: initialModel,
  });
  const model = visibleCalendarModel(view, initialModel);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkRefreshPending, setBulkRefreshPending] = useState(false);
  const [workEditing, setWorkEditing] = useState(false);
  const [workRefreshPending, setWorkRefreshPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function navigate(delta: number) {
    if (loading || selectionMode) return;
    setLoading(true);
    setError(null);
    setSelectedDate(null);
    setView({ source: initialModel, model });
    try {
      const nextModel = await loadAdjacentCalendarMonth(model, delta);
      setView({ source: initialModel, model: nextModel });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load that month. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshAfterMutation() {
    try {
      const refreshed = await reloadDisplayedCalendarMonth(model);
      setView({ source: initialModel, model: refreshed });
      setError(null);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to refresh the calendar",
      );
      return false;
    }
  }

  async function refreshAfterWorkChange() {
    const refreshed = await refreshAfterMutation();
    setWorkRefreshPending(!refreshed);
    if (!refreshed)
      setError("Work calendar saved, but the room calendar could not refresh.");
    return refreshed;
  }

  function chooseDate(date: string) {
    if (!selectionMode) {
      setSelectedDate(date);
      return;
    }
    if (bulkRefreshPending) return;
    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((selected) => selected !== date)
        : [...current, date].sort(),
    );
  }

  async function refreshAfterBulkCreate() {
    setBulkRefreshPending(true);
    const refreshed = await refreshAfterMutation();
    if (refreshed) {
      setBulkRefreshPending(false);
      setSelectedDates([]);
      setSelectionMode(false);
      setBulkEditing(false);
    }
    return refreshed;
  }

  const dates = Object.keys(model.days).sort();
  const canSelect = model.members.some(
    (member) => member.userId === model.currentUser.id,
  );
  const leadingDays = weekdayMondayFirst(model.monthStart) - 1;
  return (
    <section
      aria-label="Monthly calendar"
      className="min-w-0 rounded-3xl border border-[#dce8e0] bg-[#f4f8f3] p-0.5 sm:p-5"
    >
      <div className="flex items-center justify-between gap-2 px-1 py-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => void navigate(-1)}
          disabled={loading || selectionMode}
          className="min-h-11 min-w-11 rounded-full bg-white text-xl font-semibold text-[#276451] disabled:opacity-50"
        >
          ‹
        </button>
        <h2
          className="text-center text-lg font-semibold text-[#18332f]"
          aria-live="polite"
        >
          {monthNames[model.month - 1]} {model.year}
        </h2>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => void navigate(1)}
          disabled={loading || selectionMode}
          className="min-h-11 min-w-11 rounded-full bg-white text-xl font-semibold text-[#276451] disabled:opacity-50"
        >
          ›
        </button>
      </div>
      {model.members.length === 0 && (
        <p className="px-1 pb-3 text-sm text-[#567269]">
          No calendar participants yet. The room owner can join as a participant
          below.
        </p>
      )}
      {error && (
        <p role="alert" className="px-1 pb-3 text-sm text-[#a02f25]">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => setWorkEditing(true)}
        disabled={loading || selectionMode}
        className="mb-3 mr-2 min-h-11 rounded-xl border border-[#bfd4c6] bg-white px-4 font-semibold text-[#205545] disabled:opacity-50"
      >
        Work calendar
      </button>
      {workRefreshPending && (
        <button
          type="button"
          onClick={() => void refreshAfterWorkChange()}
          className="mb-3 min-h-11 rounded-xl bg-[#205545] px-4 font-semibold text-white"
        >
          Retry calendar refresh
        </button>
      )}
      {canSelect && !selectionMode && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (loading) return;
            setSelectedDate(null);
            setSelectedDates([]);
            setSelectionMode(true);
          }}
          className="mb-3 min-h-11 rounded-xl bg-[#205545] px-4 font-semibold text-white"
        >
          Select dates
        </button>
      )}
      <div className="grid grid-cols-7 gap-px">
        {weekdays.map((day) => (
          <span
            key={day}
            aria-label={day}
            className="py-1 text-center text-[10px] font-semibold uppercase text-[#567269]"
          >
            {day.slice(0, 2)}
          </span>
        ))}
        {Array.from({ length: leadingDays }, (_, index) => (
          <div key={`leading-${index}`} aria-hidden="true" />
        ))}
        {dates.map((date) => (
          <CalendarDay
            key={date}
            date={date}
            model={model}
            onOpen={chooseDate}
            selectionMode={selectionMode}
            selected={selectedDates.includes(date)}
          />
        ))}
      </div>
      {loading && (
        <p role="status" className="mt-2 px-1 text-sm text-[#567269]">
          Loading month…
        </p>
      )}
      {selectedDate && model.days[selectedDate] && (
        <DayDetailSheet
          date={selectedDate}
          model={model}
          onClose={() => setSelectedDate(null)}
          onMutated={refreshAfterMutation}
        />
      )}
      {selectionMode && !bulkEditing && (
        <div className="sticky bottom-0 z-20 -mx-0.5 mt-3 flex flex-wrap items-center gap-2 rounded-t-2xl border border-[#cddfd3] bg-[#f4f8f3] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-lg sm:mx-0 sm:rounded-2xl">
          {bulkRefreshPending ? (
            <>
              <span className="mr-auto text-sm font-semibold text-[#18332f]">
                Events added. Calendar needs refresh.
              </span>
              <button
                type="button"
                onClick={() => void refreshAfterBulkCreate()}
                className="min-h-11 rounded-xl bg-[#205545] px-4 font-semibold text-white"
              >
                Retry calendar refresh
              </button>
            </>
          ) : (
            <>
              <span
                aria-live="polite"
                className="mr-auto text-sm font-semibold text-[#18332f]"
              >
                {selectedDates.length} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedDates([])}
                disabled={selectedDates.length === 0}
                className="min-h-11 rounded-xl px-3 text-[#276451] disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDates([]);
                  setSelectionMode(false);
                }}
                className="min-h-11 rounded-xl px-3 text-[#276451]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setBulkEditing(true)}
                disabled={selectedDates.length === 0}
                className="min-h-11 rounded-xl bg-[#205545] px-4 font-semibold text-white disabled:opacity-50"
              >
                Continue
              </button>
            </>
          )}
        </div>
      )}
      {bulkEditing && (
        <BulkEventEditor
          roomId={model.room.id}
          dates={selectedDates}
          statuses={model.statuses}
          locations={model.locations}
          onClose={() => setBulkEditing(false)}
          onCreated={refreshAfterBulkCreate}
        />
      )}
      {workEditing && (
        <WorkCalendarEditor
          initialYear={model.year}
          initialMonth={model.month}
          onClose={() => setWorkEditing(false)}
          onChanged={refreshAfterWorkChange}
        />
      )}
    </section>
  );
}
