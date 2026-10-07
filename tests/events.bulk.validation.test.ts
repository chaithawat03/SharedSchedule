import { describe, expect, it } from "vitest";
import { normalizeBulkEventInput } from "../lib/events/bulk-validation";

const statusId = "30000000-0000-4000-8000-000000000001";
const locationId = "40000000-0000-4000-8000-000000000001";
const valid = {
  dates: ["2026-10-11", "2026-10-04"],
  event: { statusId, allDay: true, title: " Shift ", note: " Note " },
};

describe("bulk event request validation", () => {
  it("sorts dates, creates single-day values, and normalizes all-day details", () => {
    expect(
      normalizeBulkEventInput({
        ...valid,
        event: {
          ...valid.event,
          startTime: "07:40",
          endTime: "17:00",
          endTimeOpen: true,
        },
      }),
    ).toMatchObject([
      {
        startDate: "2026-10-04",
        endDate: "2026-10-04",
        title: "Shift",
        note: "Note",
        startTime: null,
        endTime: null,
        endTimeOpen: false,
      },
      { startDate: "2026-10-11", endDate: "2026-10-11" },
    ]);
  });

  it.each([
    ["empty dates", []],
    [
      "more than 31 dates",
      Array.from(
        { length: 32 },
        (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`,
      ),
    ],
    ["duplicate dates", ["2026-10-04", "2026-10-04"]],
    ["invalid Gregorian date", ["2026-02-30"]],
    ["different months", ["2026-10-31", "2026-11-01"]],
    ["different years", ["2026-10-31", "2027-10-01"]],
  ])("rejects %s", (_name, dates) => {
    expect(() => normalizeBulkEventInput({ ...valid, dates })).toThrow();
  });

  it.each([
    "id",
    "roomId",
    "ownerUserId",
    "createdBy",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "startDate",
    "endDate",
  ])("rejects forbidden template field %s", (field) => {
    expect(() =>
      normalizeBulkEventInput({
        ...valid,
        event: { ...valid.event, [field]: "2026-10-04" },
      }),
    ).toThrow();
  });

  it("requires same-day timed end after start", () => {
    const event = {
      statusId,
      allDay: false,
      startTime: "07:40",
      endTime: "17:00",
    };
    expect(normalizeBulkEventInput({ ...valid, event })[0]).toMatchObject(
      event,
    );
    expect(() =>
      normalizeBulkEventInput({
        ...valid,
        event: { ...event, endTime: "07:40" },
      }),
    ).toThrow();
    expect(() =>
      normalizeBulkEventInput({
        ...valid,
        event: { ...event, endTime: "06:00" },
      }),
    ).toThrow();
  });

  it("rejects simultaneous master and custom locations", () => {
    expect(() =>
      normalizeBulkEventInput({
        ...valid,
        event: { ...valid.event, locationId, locationText: "Other" },
      }),
    ).toThrow();
  });
});
