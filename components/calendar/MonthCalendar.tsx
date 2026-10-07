"use client";

import { useState } from "react";
import { shiftMonth, weekdayMondayFirst } from "../../lib/calendar/date";
import type { CalendarMonth } from "../../types/calendar";
import { CalendarDay } from "./CalendarDay";
import { DayDetailSheet } from "./DayDetailSheet";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function navigate(delta: number) {
    if (loading) return;
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

  const dates = Object.keys(model.days).sort();
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
          disabled={loading}
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
          disabled={loading}
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
            onOpen={setSelectedDate}
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
    </section>
  );
}
