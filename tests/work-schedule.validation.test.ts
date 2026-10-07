import { describe, expect, it } from "vitest";
import {
  normalizePatternWeek,
  normalizeOverrideCreate,
  normalizeOverridePatch,
  validateOverrideMonth,
} from "../lib/work-schedule/validation";

const days = [
  { weekday: 1, state: "WORK", startTime: "07:40", endTime: "17:00" },
  { weekday: 2, state: "NONE" },
  { weekday: 3, state: "OFF", startTime: "09:00", endTime: "18:00" },
  { weekday: 4, state: "NONE" },
  { weekday: 5, state: "NONE" },
  { weekday: 6, state: "NONE" },
  { weekday: 7, state: "NONE" },
];

describe("work schedule validation", () => {
  it("orders seven logical weekdays and clears OFF/NONE times", () => {
    expect(normalizePatternWeek({ days: [...days].reverse() })).toEqual([
      { weekday: 1, state: "WORK", startTime: "07:40", endTime: "17:00" },
      { weekday: 2, state: "NONE", startTime: null, endTime: null },
      { weekday: 3, state: "OFF", startTime: null, endTime: null },
      ...[4, 5, 6, 7].map((weekday) => ({
        weekday,
        state: "NONE",
        startTime: null,
        endTime: null,
      })),
    ]);
  });

  it.each([
    [{ days: days.slice(0, 6) }, "seven"],
    [{ days: [...days.slice(0, 6), days[0]] }, "once"],
    [{ days: [...days.slice(0, 6), { weekday: 8, state: "OFF" }] }, "weekday"],
    [{ days, userId: "other" }, "userId"],
    [{ days: [{ ...days[0], roomId: "room" }, ...days.slice(1)] }, "roomId"],
    [{ days: [{ ...days[0], endTime: "07:40" }, ...days.slice(1)] }, "later"],
    [{ days: [{ ...days[0], startTime: null }, ...days.slice(1)] }, "time"],
    [
      {
        days: [
          { ...days[0], startTime: "22:00", endTime: "06:00" },
          ...days.slice(1),
        ],
      },
      "later",
    ],
  ])("rejects invalid whole-week input %#", (input, message) => {
    expect(() => normalizePatternWeek(input)).toThrow(message);
  });

  it("validates real dates and local times, including leap days", () => {
    expect(
      normalizeOverrideCreate({
        date: "2028-02-29",
        type: "WORK",
        startTime: "07:40",
        endTime: "17:00",
        note: " Factory Saturday ",
      }),
    ).toEqual({
      date: "2028-02-29",
      type: "WORK",
      startTime: "07:40",
      endTime: "17:00",
      note: "Factory Saturday",
    });
    expect(() =>
      normalizeOverrideCreate({ date: "2026-02-29", type: "OFF" }),
    ).toThrow("date");
    expect(() =>
      normalizeOverrideCreate({
        date: "2026-10-10",
        type: "WORK",
        startTime: "22:00",
        endTime: "06:00",
      }),
    ).toThrow("later");
    expect(() =>
      normalizeOverrideCreate({
        date: "2026-10-10",
        type: "WORK",
        startTime: "07:40:00",
        endTime: "17:00",
      }),
    ).toThrow("HH:mm");
  });

  it("normalizes OFF and validates an effective PATCH while forbidding date changes", () => {
    const existing = {
      date: "2026-10-10",
      type: "WORK" as const,
      startTime: "07:40",
      endTime: "17:00",
      note: null,
    };
    expect(normalizeOverrideCreate({ ...existing, type: "OFF" })).toMatchObject(
      { type: "OFF", startTime: null, endTime: null },
    );
    expect(normalizeOverridePatch({ type: "OFF" }, existing)).toEqual({
      ...existing,
      type: "OFF",
      startTime: null,
      endTime: null,
    });
    expect(() =>
      normalizeOverridePatch({ endTime: "07:40" }, existing),
    ).toThrow("later");
    expect(() =>
      normalizeOverridePatch({ date: "2026-10-11" }, existing),
    ).toThrow("date");
    expect(() =>
      normalizeOverrideCreate({ ...existing, userId: "other" }),
    ).toThrow("userId");
  });

  it("validates a bounded override month", () => {
    expect(validateOverrideMonth("2026", "10")).toEqual({
      year: 2026,
      month: 10,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(() => validateOverrideMonth("2026x", "10")).toThrow();
    expect(() => validateOverrideMonth("2026", "13")).toThrow();
  });
});
