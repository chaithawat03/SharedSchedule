import { describe, expect, it } from "vitest";
import {
  bangkokToday,
  daysInMonth,
  monthDates,
  shiftMonth,
  weekdayMondayFirst,
} from "../lib/calendar/date";

describe("calendar dates", () => {
  it("maps Monday to 1 and Sunday to 7 without local timezone parsing", () => {
    expect(weekdayMondayFirst("2026-10-12")).toBe(1);
    expect(weekdayMondayFirst("2026-10-11")).toBe(7);
  });

  it("includes leap day and exactly the requested month", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(monthDates(2028, 2)).toHaveLength(29);
    expect(monthDates(2028, 2)[0]).toBe("2028-02-01");
    expect(monthDates(2028, 2).at(-1)).toBe("2028-02-29");
    expect(daysInMonth(2027, 2)).toBe(28);
  });

  it("navigates across both year boundaries", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("calculates today in Bangkok at UTC day boundaries", () => {
    expect(bangkokToday(new Date("2026-10-11T17:30:00.000Z"))).toBe(
      "2026-10-12",
    );
    expect(bangkokToday(new Date("2026-10-12T16:59:00.000Z"))).toBe(
      "2026-10-12",
    );
  });

  it("keeps calendar dates stable when the server timezone differs", () => {
    const originalTimezone = process.env.TZ;
    try {
      process.env.TZ = "America/Los_Angeles";
      expect(weekdayMondayFirst("2026-10-12")).toBe(1);
      expect(monthDates(2026, 10)[0]).toBe("2026-10-01");
      expect(bangkokToday(new Date("2026-10-11T17:30:00.000Z"))).toBe(
        "2026-10-12",
      );
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });
});
