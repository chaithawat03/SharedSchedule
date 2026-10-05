import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  events,
  roomMembers,
  rooms,
  users,
  workOverrides,
  workPatterns,
} from "../lib/db/schema";

describe("foundation schema", () => {
  it("uses a unique phone identity separate from the user UUID", () => {
    const config = getTableConfig(users);
    expect(config.columns.find((column) => column.name === "id")?.primary).toBe(
      true,
    );
    expect(
      config.columns.find((column) => column.name === "phone_normalized")
        ?.isUnique,
    ).toBe(true);
  });

  it("keeps room ownership independent of calendar membership", () => {
    const room = getTableConfig(rooms);
    const members = getTableConfig(roomMembers);
    expect(room.columns.some((column) => column.name === "owner_user_id")).toBe(
      true,
    );
    expect(
      members.uniqueConstraints.some(
        (constraint) =>
          constraint.columns.map((column) => column.name).join(",") ===
          "room_id,user_id",
      ),
    ).toBe(true);
  });

  it("allows a weekly pattern and a single date override per user", () => {
    const patterns = getTableConfig(workPatterns);
    const overrides = getTableConfig(workOverrides);
    expect(
      patterns.uniqueConstraints.some(
        (constraint) =>
          constraint.columns.map((column) => column.name).join(",") ===
          "user_id,weekday",
      ),
    ).toBe(true);
    expect(
      overrides.uniqueConstraints.some(
        (constraint) =>
          constraint.columns.map((column) => column.name).join(",") ===
          "user_id,date",
      ),
    ).toBe(true);
  });

  it("models multi-day and open-ended events without a one-event-per-date constraint", () => {
    const config = getTableConfig(events);
    const columns = new Set(config.columns.map((column) => column.name));
    for (const name of [
      "start_date",
      "end_date",
      "start_time",
      "end_time",
      "end_time_open",
      "all_day",
      "deleted_at",
    ]) {
      expect(columns.has(name)).toBe(true);
    }
    expect(config.uniqueConstraints).toHaveLength(0);
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "events_room_dates_idx",
        "events_owner_start_idx",
        "events_status_idx",
      ]),
    );
  });
});
