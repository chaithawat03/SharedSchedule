import {
  EventInputError,
  normalizeEventValues,
  type EventValues,
} from "./validation";

const templateFields = new Set([
  "statusId",
  "allDay",
  "title",
  "startTime",
  "endTime",
  "endTimeOpen",
  "locationId",
  "locationText",
  "note",
]);

export function normalizeBulkEventInput(input: unknown): EventValues[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new EventInputError("Enter bulk event details");
  const request = input as Record<string, unknown>;
  if (Object.keys(request).some((key) => key !== "dates" && key !== "event"))
    throw new EventInputError("Unexpected bulk request field");
  if (
    !Array.isArray(request.dates) ||
    request.dates.length < 1 ||
    request.dates.length > 31
  )
    throw new EventInputError("Select between 1 and 31 dates");
  if (
    !request.event ||
    typeof request.event !== "object" ||
    Array.isArray(request.event)
  )
    throw new EventInputError("Enter an event template");
  const event = request.event as Record<string, unknown>;
  for (const key of Object.keys(event)) {
    if (!templateFields.has(key))
      throw new EventInputError(`Cannot change ${key}`);
  }
  const dates = [...request.dates];
  if (dates.some((value) => typeof value !== "string"))
    throw new EventInputError("Enter valid dates");
  dates.sort();
  if (new Set(dates).size !== dates.length)
    throw new EventInputError("Select each date only once");
  const values = dates.map((selectedDate) =>
    normalizeEventValues({
      ...event,
      startDate: selectedDate,
      endDate: selectedDate,
    }),
  );
  if (
    values.some(
      (value) =>
        value.startDate.slice(0, 7) !== values[0].startDate.slice(0, 7),
    )
  )
    throw new EventInputError("Select dates in the same month");
  return values;
}
