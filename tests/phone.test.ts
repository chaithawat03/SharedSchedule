import { describe, expect, it } from "vitest";
import { parseThaiPhone } from "../lib/phone";

describe("Thai mobile phone normalization", () => {
  it.each([
    "0812345678",
    "081-234-5678",
    "+66 81 234 5678",
    "+66812345678",
    "66812345678",
  ])("normalizes %s to the same identity and display number", (input) => {
    expect(parseThaiPhone(input)).toEqual({
      normalized: "+66812345678",
      display: "0812345678",
    });
  });

  it.each([
    "",
    "021234567",
    "081234567",
    "08123456789",
    "+67812345678",
    "08123abc78",
    "++66812345678",
    "+660812345678",
  ])("rejects invalid input %s", (input) => {
    expect(() => parseThaiPhone(input)).toThrow(
      "Enter a valid Thai mobile number",
    );
  });
});
