import { describe, expect, it } from "vitest";
import { normalizeEventValues } from "../lib/events/validation";

const base = {
  statusId: "30000000-0000-4000-8000-000000000001",
  startDate: "2026-10-12",
  endDate: "2026-10-12",
  allDay: false,
  startTime: "17:20",
  endTime: "19:40",
  endTimeOpen: true,
};

describe("event input validation", () => {
  it("rejects impossible dates and reversed spans", () => {
    expect(() =>
      normalizeEventValues({ ...base, startDate: "2026-02-30" }),
    ).toThrow();
    expect(() =>
      normalizeEventValues({ ...base, endDate: "2026-10-11" }),
    ).toThrow();
    expect(() =>
      normalizeEventValues({ ...base, startDate: "2025-02-29" }),
    ).toThrow();
    expect(
      normalizeEventValues({
        ...base,
        startDate: "2024-02-29",
        endDate: "2024-02-29",
      }).startDate,
    ).toBe("2024-02-29");
  });

  it("normalizes all-day stale times and custom location", () => {
    expect(
      normalizeEventValues({
        ...base,
        allDay: true,
        locationText: "  Bangkok  ",
      }),
    ).toMatchObject({
      startTime: null,
      endTime: null,
      endTimeOpen: false,
      locationId: null,
      locationText: "Bangkok",
    });
  });

  it("requires complete strict times and a later end on one date", () => {
    for (const input of [
      { endTime: null },
      { startTime: "17:20:00" },
      { endTime: "17:20" },
      { endTime: "16:00" },
      { endTime: "24:00" },
    ])
      expect(() => normalizeEventValues({ ...base, ...input })).toThrow();
    expect(normalizeEventValues(base).endTimeOpen).toBe(true);
  });

  it("accepts an overnight multi-day span", () => {
    expect(
      normalizeEventValues({
        ...base,
        startDate: "2026-12-27",
        endDate: "2026-12-28",
        startTime: "22:00",
        endTime: "06:00",
      }),
    ).toMatchObject({
      startDate: "2026-12-27",
      endDate: "2026-12-28",
      startTime: "22:00",
      endTime: "06:00",
    });
  });

  it("rejects immutable fields and ambiguous locations", () => {
    expect(() =>
      normalizeEventValues({ ...base, ownerUserId: "stranger" }),
    ).toThrow();
    expect(() =>
      normalizeEventValues({
        ...base,
        locationId: "40000000-0000-4000-8000-000000000001",
        locationText: "Other",
      }),
    ).toThrow();
  });
});
