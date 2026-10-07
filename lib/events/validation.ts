export class EventInputError extends Error {}

export type EventValues = {
  statusId: string;
  title: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  endTimeOpen: boolean;
  allDay: boolean;
  locationId: string | null;
  locationText: string | null;
  note: string | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const editable = new Set<keyof EventValues>([
  "statusId",
  "title",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
  "endTimeOpen",
  "allDay",
  "locationId",
  "locationText",
  "note",
]);

function fail(message: string): never {
  throw new EventInputError(message);
}

function optionalText(
  value: unknown,
  max: number,
  label: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") fail(`${label} must be text`);
  const result = value.trim();
  if (result.length > max) fail(`${label} is too long`);
  return result || null;
}

function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail("Enter a valid date");
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1])
    fail("Enter a valid date");
  return value;
}

function time(value: unknown): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    fail("Enter time as HH:mm");
  return value;
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !uuid.test(value))
    fail(`Select a valid ${label}`);
  return value.toLowerCase();
}

export function isUuid(value: string): boolean {
  return uuid.test(value);
}

export function normalizeEventValues(
  input: unknown,
  existing?: EventValues,
): EventValues {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Enter event details");
  const patch = input as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    if (!editable.has(key as keyof EventValues)) fail(`Cannot change ${key}`);
  }
  const value = { ...existing, ...patch } as Record<string, unknown>;
  const statusId = id(value.statusId, "status");
  const startDate = date(value.startDate);
  const endDate = date(value.endDate);
  if (endDate < startDate) fail("End date must not precede start date");
  const allDay = value.allDay === undefined ? false : value.allDay;
  if (typeof allDay !== "boolean") fail("All day must be true or false");
  const endTimeOpen =
    value.endTimeOpen === undefined ? false : value.endTimeOpen;
  if (typeof endTimeOpen !== "boolean")
    fail("End time + must be true or false");

  let locationId =
    value.locationId == null ? null : id(value.locationId, "location");
  let locationText = optionalText(value.locationText, 200, "Custom location");
  const changedId = Object.hasOwn(patch, "locationId");
  const changedText = Object.hasOwn(patch, "locationText");
  if (changedId && changedText && locationId && locationText)
    fail("Choose a master or custom location");
  if (changedId && !changedText) locationText = null;
  if (changedText && !changedId) locationId = null;
  if (locationId && locationText) fail("Choose a master or custom location");

  const startTime = allDay ? null : time(value.startTime);
  const endTime = allDay ? null : time(value.endTime);
  if (!allDay && startDate === endDate && endTime! <= startTime!)
    fail("End time must be later than start time");
  return {
    statusId,
    title: optionalText(value.title, 200, "Title"),
    startDate,
    endDate,
    startTime,
    endTime,
    endTimeOpen: allDay ? false : endTimeOpen,
    allDay,
    locationId,
    locationText,
    note: optionalText(value.note, 10000, "Note"),
  };
}
