import { daysInMonth } from "../calendar/date";

export class WorkScheduleInputError extends Error {}

export type PatternDay = {
  weekday: number;
  state: "NONE" | "WORK" | "OFF";
  startTime: string | null;
  endTime: string | null;
};

export type OverrideValues = {
  date: string;
  type: "WORK" | "OFF";
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};

function fail(message: string): never {
  throw new WorkScheduleInputError(message);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`Enter ${label}`);
  return value as Record<string, unknown>;
}

function onlyKeys(value: Record<string, unknown>, allowed: string[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`Cannot change ${key}`);
  }
}

function localTime(value: unknown): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    fail("Enter time as HH:mm");
  return value;
}

function workTimes(value: Record<string, unknown>) {
  const startTime = localTime(value.startTime);
  const endTime = localTime(value.endTime);
  if (endTime <= startTime) fail("End time must be later than start time");
  return { startTime, endTime };
}

export function realDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail("Enter a valid date");
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  )
    fail("Enter a valid date");
  return value;
}

function note(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") fail("Note must be text");
  const normalized = value.trim();
  if (normalized.length > 10000) fail("Note is too long");
  return normalized || null;
}

export function normalizePatternWeek(input: unknown): PatternDay[] {
  const request = object(input, "weekly work pattern");
  onlyKeys(request, ["days"]);
  if (!Array.isArray(request.days) || request.days.length !== 7)
    fail("Provide exactly seven weekdays");
  const days = request.days.map((raw): PatternDay => {
    const day = object(raw, "weekday");
    onlyKeys(day, ["weekday", "state", "startTime", "endTime"]);
    if (
      !Number.isInteger(day.weekday) ||
      Number(day.weekday) < 1 ||
      Number(day.weekday) > 7
    )
      fail("Enter a weekday from 1 to 7");
    if (day.state !== "NONE" && day.state !== "WORK" && day.state !== "OFF")
      fail("Choose No default, Work, or Off");
    const times =
      day.state === "WORK"
        ? workTimes(day)
        : { startTime: null, endTime: null };
    return { weekday: Number(day.weekday), state: day.state, ...times };
  });
  if (new Set(days.map((day) => day.weekday)).size !== 7)
    fail("Provide each weekday once");
  return days.sort((a, b) => a.weekday - b.weekday);
}

function normalizeOverride(value: Record<string, unknown>): OverrideValues {
  const date = realDate(value.date);
  if (value.type !== "WORK" && value.type !== "OFF") fail("Choose Work or Off");
  const times =
    value.type === "WORK"
      ? workTimes(value)
      : { startTime: null, endTime: null };
  return { date, type: value.type, ...times, note: note(value.note) };
}

export function normalizeOverrideCreate(input: unknown): OverrideValues {
  const value = object(input, "date exception");
  onlyKeys(value, ["date", "type", "startTime", "endTime", "note"]);
  return normalizeOverride(value);
}

export function normalizeOverridePatch(
  input: unknown,
  existing: OverrideValues,
): OverrideValues {
  const patch = object(input, "date exception changes");
  onlyKeys(patch, ["type", "startTime", "endTime", "note"]);
  return normalizeOverride({ ...existing, ...patch });
}

export function validateOverrideMonth(
  yearText: string | null,
  monthText: string | null,
) {
  if (
    !yearText ||
    !/^\d{4}$/.test(yearText) ||
    !monthText ||
    !/^\d{1,2}$/.test(monthText)
  )
    fail("Enter a valid year and month");
  const year = Number(yearText);
  const month = Number(monthText);
  if (year < 1 || month < 1 || month > 12) fail("Enter a valid year and month");
  const prefix = `${yearText}-${String(month).padStart(2, "0")}`;
  return {
    year,
    month,
    start: `${prefix}-01`,
    end: `${prefix}-${String(daysInMonth(year, month)).padStart(2, "0")}`,
  };
}
