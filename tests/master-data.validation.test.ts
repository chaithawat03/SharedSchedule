import { describe, expect, it } from "vitest";
import {
  normalizeLocationCreate,
  normalizeLocationPatch,
  normalizeStatusCreate,
  normalizeStatusPatch,
  normalizeStatusOrder,
} from "../lib/master-data/validation";

describe("room master validation", () => {
  it("normalizes a custom status and rejects immutable or malformed values", () => {
    expect(
      normalizeStatusCreate({
        code: " field_work ",
        name: "  Field Work  ",
        color: "#aa22ff",
        icon: "briefcase",
      }),
    ).toEqual({
      code: "FIELD_WORK",
      name: "Field Work",
      color: "#AA22FF",
      icon: "briefcase",
    });
    for (const input of [
      { code: "bad-code", name: "Valid" },
      { code: "ß", name: "Valid" },
      { code: "WORK", name: "" },
      { code: "X", name: "Hi\nthere" },
      { code: "X", name: "Valid", color: "red" },
      { code: "X", name: "Valid", icon: "<svg>" },
      { code: "X", name: "Valid", active: false },
    ])
      expect(() => normalizeStatusCreate(input)).toThrow();
    expect(() => normalizeStatusPatch({ code: "NEW" })).toThrow();
    expect(() => normalizeStatusPatch({ roomId: "other" })).toThrow();
    expect(() => normalizeStatusPatch({ sortOrder: 2 })).toThrow();
    expect(
      normalizeStatusPatch({
        name: " Factory Shift ",
        icon: null,
        color: null,
      }),
    ).toEqual({ name: "Factory Shift", icon: null, color: null });
  });

  it("normalizes locations and rejects system fields and invalid names", () => {
    expect(normalizeLocationCreate({ name: " MCP " })).toEqual({ name: "MCP" });
    expect(
      normalizeLocationPatch({ active: false, name: " Branch A " }),
    ).toEqual({ active: false, name: "Branch A" });
    for (const input of [
      { name: " " },
      { name: "A\u0000B" },
      { name: "x", id: "forged" },
    ])
      expect(() => normalizeLocationCreate(input)).toThrow();
    expect(() => normalizeLocationPatch({ createdAt: "now" })).toThrow();
  });

  it("requires an ordered list of distinct UUIDs", () => {
    const id = "30000000-0000-4000-8000-000000000001";
    expect(normalizeStatusOrder({ ids: [id.toUpperCase()] })).toEqual([id]);
    expect(() => normalizeStatusOrder({ ids: [id, id] })).toThrow();
    expect(() => normalizeStatusOrder({ ids: ["wrong"] })).toThrow();
    expect(() => normalizeStatusOrder({ ids: [], roomId: "forged" })).toThrow();
  });
});
