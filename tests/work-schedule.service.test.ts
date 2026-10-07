import { describe, expect, it } from "vitest";
import {
  createWorkOverride,
  deleteWorkOverride,
  getWorkOverrides,
  getWorkPattern,
  patchWorkOverride,
  putWorkPattern,
  type PatternRecord,
  type OverrideRecord,
  type WorkScheduleRepository,
} from "../services/work-schedule.service";

const user = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const now = new Date("2026-10-07T00:00:00Z");
const week = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  state: "NONE",
}));

function fixture() {
  const patterns: PatternRecord[] = [];
  const overrides: OverrideRecord[] = [];
  const audits: {
    action: string;
    roomId: null;
    entityId: string;
    oldValue: unknown;
    newValue: unknown;
  }[] = [];
  let nextId = 1;
  let failAudit = false;
  const id = () =>
    `40000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
  const repository: WorkScheduleRepository = {
    async patterns(owner) {
      return patterns.filter((row) => row.userId === owner);
    },
    async overrides(owner, start, end) {
      return overrides.filter(
        (row) => row.userId === owner && row.date >= start && row.date <= end,
      );
    },
    async transaction(owner, run) {
      const beforePatterns = structuredClone(patterns);
      const beforeOverrides = structuredClone(overrides);
      const beforeAudits = structuredClone(audits);
      try {
        return await run({
          async patternRows() {
            return patterns.filter((row) => row.userId === owner);
          },
          async override(overrideId) {
            return (
              overrides.find(
                (row) => row.id === overrideId && row.userId === owner,
              ) ?? null
            );
          },
          async overrideForDate(date) {
            return (
              overrides.find(
                (row) => row.userId === owner && row.date === date,
              ) ?? null
            );
          },
          async insertPattern(values) {
            const row = {
              ...values,
              id: id(),
              userId: owner,
              createdAt: now,
              updatedAt: now,
            };
            patterns.push(row);
            return row;
          },
          async updatePattern(row, values, at) {
            const updated = { ...row, ...values, updatedAt: at };
            patterns.splice(patterns.indexOf(row), 1, updated);
            return updated;
          },
          async deletePattern(row) {
            patterns.splice(patterns.indexOf(row), 1);
          },
          async insertOverride(values) {
            const row = {
              ...values,
              id: id(),
              userId: owner,
              createdAt: now,
              updatedAt: now,
            };
            overrides.push(row);
            return row;
          },
          async updateOverride(row, values, at) {
            const updated = { ...row, ...values, updatedAt: at };
            overrides.splice(overrides.indexOf(row), 1, updated);
            return updated;
          },
          async deleteOverride(row) {
            overrides.splice(overrides.indexOf(row), 1);
          },
          async audit(action, entityId, oldValue, newValue) {
            if (failAudit) throw new Error("audit failed");
            audits.push({ action, roomId: null, entityId, oldValue, newValue });
          },
        });
      } catch (error) {
        patterns.splice(0, patterns.length, ...beforePatterns);
        overrides.splice(0, overrides.length, ...beforeOverrides);
        audits.splice(0, audits.length, ...beforeAudits);
        throw error;
      }
    },
  };
  return {
    repository,
    patterns,
    overrides,
    audits,
    setFailAudit: (value: boolean) => {
      failAudit = value;
    },
  };
}

describe("personal work schedule service", () => {
  it("GET returns seven logical days with missing rows as NONE", async () => {
    const f = fixture();
    f.patterns.push({
      id: "p1",
      userId: user,
      weekday: 3,
      working: false,
      startTime: null,
      endTime: null,
      createdAt: now,
      updatedAt: now,
    });
    const days = await getWorkPattern(user, f.repository);
    expect(days).toHaveLength(7);
    expect(days.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days[0].state).toBe("NONE");
    expect(days[2].state).toBe("OFF");
  });

  it("atomically creates, updates and deletes only changed weekdays and audits snapshots", async () => {
    const f = fixture();
    const old = {
      id: "p1",
      userId: user,
      weekday: 1,
      working: true,
      startTime: "08:00",
      endTime: "17:00",
      createdAt: now,
      updatedAt: now,
    };
    const removed = {
      ...old,
      id: "p2",
      weekday: 2,
      working: false,
      startTime: null,
      endTime: null,
    };
    const unchanged = { ...old, id: "p3", weekday: 3 };
    f.patterns.push(old, removed, unchanged);
    await putWorkPattern(
      user,
      {
        days: [
          { weekday: 1, state: "WORK", startTime: "07:40", endTime: "17:00" },
          { weekday: 2, state: "NONE" },
          { weekday: 3, state: "WORK", startTime: "08:00", endTime: "17:00" },
          { weekday: 4, state: "OFF", startTime: "09:00" },
          ...week.slice(4),
        ],
      },
      f.repository,
    );
    expect(f.patterns.map((row) => row.weekday).sort()).toEqual([1, 3, 4]);
    expect(f.patterns.find((row) => row.weekday === 3)).toBe(unchanged);
    expect(f.patterns.find((row) => row.weekday === 1)).toMatchObject({
      id: "p1",
      startTime: "07:40",
    });
    expect(f.patterns.find((row) => row.weekday === 4)).toMatchObject({
      working: false,
      startTime: null,
    });
    expect(f.audits.map((row) => row.action)).toEqual([
      "UPDATE_WORK_PATTERN",
      "DELETE_WORK_PATTERN",
      "CREATE_WORK_PATTERN",
    ]);
    expect(f.audits[0].oldValue).toBe(old);
    expect(f.audits[1].newValue).toBeNull();
    expect(f.audits[2].oldValue).toBeNull();
  });

  it("normalized no-op PUT leaves rows and audits untouched; failed audit rolls back all changes", async () => {
    const f = fixture();
    const row = {
      id: "p1",
      userId: user,
      weekday: 1,
      working: false,
      startTime: null,
      endTime: null,
      createdAt: now,
      updatedAt: now,
    };
    f.patterns.push(row);
    await putWorkPattern(
      user,
      {
        days: [
          { weekday: 1, state: "OFF", startTime: "08:00" },
          ...week.slice(1),
        ],
      },
      f.repository,
    );
    expect(f.patterns[0]).toBe(row);
    expect(f.audits).toHaveLength(0);
    await expect(
      putWorkPattern(
        user,
        {
          days: [
            { weekday: 1, state: "NONE" },
            { weekday: 2, state: "WORK", startTime: "22:00", endTime: "06:00" },
            ...week.slice(2),
          ],
        },
        f.repository,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(f.patterns).toEqual([row]);
    expect(f.audits).toHaveLength(0);
    f.setFailAudit(true);
    await expect(
      putWorkPattern(
        user,
        {
          days: [
            { weekday: 1, state: "NONE" },
            { weekday: 2, state: "WORK", startTime: "08:00", endTime: "17:00" },
            ...week.slice(2),
          ],
        },
        f.repository,
      ),
    ).rejects.toThrow("audit failed");
    expect(f.patterns).toEqual([row]);
    expect(f.audits).toHaveLength(0);
  });

  it("creates, lists, patches and deletes own overrides with no-op audit suppression", async () => {
    const f = fixture();
    const created = await createWorkOverride(
      user,
      {
        date: "2026-10-10",
        type: "WORK",
        startTime: "07:40",
        endTime: "17:00",
        note: "Factory",
      },
      f.repository,
    );
    expect(created).toMatchObject({ date: "2026-10-10", type: "WORK" });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      (await getWorkOverrides(user, "2026", "10", f.repository)).overrides,
    ).toHaveLength(1);
    await patchWorkOverride(
      user,
      created.id,
      { note: " Factory " },
      f.repository,
    );
    expect(f.audits).toHaveLength(1);
    await patchWorkOverride(user, created.id, { type: "OFF" }, f.repository);
    expect(f.overrides[0]).toMatchObject({
      type: "OFF",
      startTime: null,
      endTime: null,
    });
    await deleteWorkOverride(user, created.id, f.repository);
    expect(f.overrides).toHaveLength(0);
    expect(f.audits.map((row) => row.action)).toEqual([
      "CREATE_WORK_OVERRIDE",
      "UPDATE_WORK_OVERRIDE",
      "DELETE_WORK_OVERRIDE",
    ]);
    expect(f.audits.every((audit) => audit.roomId === null)).toBe(true);
    expect(f.audits[0].oldValue).toBeNull();
    expect(f.audits[0].newValue).toMatchObject({
      id: created.id,
      type: "WORK",
    });
    expect(f.audits[1].oldValue).toMatchObject({ type: "WORK" });
    expect(f.audits[1].newValue).toMatchObject({
      type: "OFF",
      startTime: null,
      endTime: null,
    });
    expect(f.audits[2].oldValue).toMatchObject({ type: "OFF" });
    expect(f.audits[2].newValue).toBeNull();
  });

  it("rejects duplicate dates and hides another user's override", async () => {
    const f = fixture();
    const created = await createWorkOverride(
      user,
      { date: "2026-10-10", type: "OFF" },
      f.repository,
    );
    await expect(
      createWorkOverride(
        user,
        { date: "2026-10-10", type: "OFF" },
        f.repository,
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE" });
    await expect(
      patchWorkOverride(other, created.id, { type: "OFF" }, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      deleteWorkOverride(other, created.id, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
