import {
  normalizeOverrideCreate,
  normalizeOverridePatch,
  normalizePatternWeek,
  validateOverrideMonth,
  WorkScheduleInputError,
  type OverrideValues,
  type PatternDay,
} from "../lib/work-schedule/validation";

export type PatternRecord = {
  id: string;
  userId: string;
  weekday: number;
  working: boolean;
  startTime: string | null;
  endTime: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OverrideRecord = Omit<OverrideValues, "type"> & {
  id: string;
  userId: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
};

type AuditAction =
  | "CREATE_WORK_PATTERN"
  | "UPDATE_WORK_PATTERN"
  | "DELETE_WORK_PATTERN"
  | "CREATE_WORK_OVERRIDE"
  | "UPDATE_WORK_OVERRIDE"
  | "DELETE_WORK_OVERRIDE";

export interface WorkScheduleTransaction {
  patternRows(): Promise<PatternRecord[]>;
  override(id: string): Promise<OverrideRecord | null>;
  overrideForDate(date: string): Promise<OverrideRecord | null>;
  insertPattern(
    values: Pick<
      PatternRecord,
      "weekday" | "working" | "startTime" | "endTime"
    >,
  ): Promise<PatternRecord>;
  updatePattern(
    row: PatternRecord,
    values: Pick<PatternRecord, "working" | "startTime" | "endTime">,
    at: Date,
  ): Promise<PatternRecord>;
  deletePattern(row: PatternRecord): Promise<void>;
  insertOverride(values: OverrideValues): Promise<OverrideRecord>;
  updateOverride(
    row: OverrideRecord,
    values: OverrideValues,
    at: Date,
  ): Promise<OverrideRecord>;
  deleteOverride(row: OverrideRecord): Promise<void>;
  audit(
    action: AuditAction,
    entityId: string,
    oldValue: PatternRecord | OverrideRecord | null,
    newValue: PatternRecord | OverrideRecord | null,
  ): Promise<void>;
}

export interface WorkScheduleRepository {
  patterns(userId: string): Promise<PatternRecord[]>;
  overrides(
    userId: string,
    start: string,
    end: string,
  ): Promise<OverrideRecord[]>;
  transaction<T>(
    userId: string,
    run: (tx: WorkScheduleTransaction) => Promise<T>,
  ): Promise<T>;
}

export class WorkScheduleError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "DUPLICATE",
    message: string,
  ) {
    super(message);
  }
}

function normalize<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof WorkScheduleInputError)
      throw new WorkScheduleError("INVALID_INPUT", error.message);
    throw error;
  }
}

function clock(value: string | null) {
  return value?.slice(0, 5) ?? null;
}

function logicalDay(weekday: number, row?: PatternRecord): PatternDay {
  if (!row) return { weekday, state: "NONE", startTime: null, endTime: null };
  return {
    weekday,
    state: row.working ? "WORK" : "OFF",
    startTime: row.working ? clock(row.startTime) : null,
    endTime: row.working ? clock(row.endTime) : null,
  };
}

function week(rows: PatternRecord[]): PatternDay[] {
  const byWeekday = new Map(rows.map((row) => [row.weekday, row]));
  return Array.from({ length: 7 }, (_, index) =>
    logicalDay(index + 1, byWeekday.get(index + 1)),
  );
}

function patternValues(day: PatternDay) {
  return {
    working: day.state === "WORK",
    startTime: day.startTime,
    endTime: day.endTime,
  };
}

function samePattern(row: PatternRecord, day: PatternDay) {
  return (
    row.working === (day.state === "WORK") &&
    clock(row.startTime) === day.startTime &&
    clock(row.endTime) === day.endTime
  );
}

function overrideValues(row: OverrideRecord): OverrideValues {
  if (row.type !== "WORK" && row.type !== "OFF")
    throw new Error("Invalid persisted work override type");
  return {
    date: row.date,
    type: row.type,
    startTime: clock(row.startTime),
    endTime: clock(row.endTime),
    note: row.note,
  };
}

function sameOverride(row: OverrideRecord, value: OverrideValues) {
  return (
    row.type === value.type &&
    clock(row.startTime) === value.startTime &&
    clock(row.endTime) === value.endTime &&
    row.note === value.note
  );
}

function overrideForClient(row: OverrideRecord) {
  const { id } = row;
  return { id, ...overrideValues(row) };
}

export async function getWorkPattern(
  userId: string,
  repository: WorkScheduleRepository,
) {
  return week(await repository.patterns(userId));
}

export async function putWorkPattern(
  userId: string,
  input: unknown,
  repository: WorkScheduleRepository,
  at = new Date(),
) {
  return repository.transaction(userId, async (tx) => {
    const rows = await tx.patternRows();
    const requested = normalize(() => normalizePatternWeek(input));
    const existing = new Map(rows.map((row) => [row.weekday, row]));
    for (const day of requested) {
      const row = existing.get(day.weekday);
      if (day.state === "NONE") {
        if (row) {
          await tx.deletePattern(row);
          await tx.audit("DELETE_WORK_PATTERN", row.id, row, null);
        }
      } else if (!row) {
        const created = await tx.insertPattern({
          weekday: day.weekday,
          ...patternValues(day),
        });
        await tx.audit("CREATE_WORK_PATTERN", created.id, null, created);
      } else if (!samePattern(row, day)) {
        const updated = await tx.updatePattern(row, patternValues(day), at);
        await tx.audit("UPDATE_WORK_PATTERN", row.id, row, updated);
      }
    }
    return requested;
  });
}

export async function getWorkOverrides(
  userId: string,
  yearText: string | null,
  monthText: string | null,
  repository: WorkScheduleRepository,
) {
  const month = normalize(() => validateOverrideMonth(yearText, monthText));
  const rows = await repository.overrides(userId, month.start, month.end);
  return {
    year: month.year,
    month: month.month,
    overrides: rows
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(overrideForClient),
  };
}

export async function createWorkOverride(
  userId: string,
  input: unknown,
  repository: WorkScheduleRepository,
) {
  return repository.transaction(userId, async (tx) => {
    const values = normalize(() => normalizeOverrideCreate(input));
    if (await tx.overrideForDate(values.date))
      throw new WorkScheduleError(
        "DUPLICATE",
        "An exception already exists for this date",
      );
    const created = await tx.insertOverride(values);
    await tx.audit("CREATE_WORK_OVERRIDE", created.id, null, created);
    return overrideForClient(created);
  });
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function checkedId(id: string) {
  if (!uuid.test(id))
    throw new WorkScheduleError("NOT_FOUND", "Exception not found");
  return id.toLowerCase();
}

export async function patchWorkOverride(
  userId: string,
  id: string,
  input: unknown,
  repository: WorkScheduleRepository,
  at = new Date(),
) {
  id = checkedId(id);
  return repository.transaction(userId, async (tx) => {
    const before = await tx.override(id);
    if (!before)
      throw new WorkScheduleError("NOT_FOUND", "Exception not found");
    const values = normalize(() =>
      normalizeOverridePatch(input, overrideValues(before)),
    );
    if (sameOverride(before, values)) return overrideForClient(before);
    const updated = await tx.updateOverride(before, values, at);
    await tx.audit("UPDATE_WORK_OVERRIDE", before.id, before, updated);
    return overrideForClient(updated);
  });
}

export async function deleteWorkOverride(
  userId: string,
  id: string,
  repository: WorkScheduleRepository,
) {
  id = checkedId(id);
  return repository.transaction(userId, async (tx) => {
    const before = await tx.override(id);
    if (!before)
      throw new WorkScheduleError("NOT_FOUND", "Exception not found");
    await tx.deleteOverride(before);
    await tx.audit("DELETE_WORK_OVERRIDE", before.id, before, null);
    return overrideForClient(before);
  });
}
