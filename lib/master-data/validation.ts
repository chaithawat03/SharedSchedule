import { STATUS_ICON_TOKENS, type StatusIconToken } from "./icons";

export class MasterInputError extends Error {}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const codePattern = /^[A-Z][A-Z0-9_]{0,47}$/;
const colorPattern = /^#[0-9A-Fa-f]{6}$/;
const control = /[\x00-\x1f\x7f-\x9f]/;

function object(input: unknown, fields: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new MasterInputError("Enter valid master details");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !fields.includes(key)))
    throw new MasterInputError("Unexpected master field");
  return value;
}

function name(value: unknown, max: number): string {
  if (typeof value !== "string") throw new MasterInputError("Enter a name");
  const result = value.normalize("NFC").trim();
  if (!result || result.length > max || control.test(result))
    throw new MasterInputError(
      `Enter a name of 1 to ${max} characters without control characters`,
    );
  return result;
}

function active(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new MasterInputError("Active must be true or false");
  return value;
}

function color(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !colorPattern.test(value))
    throw new MasterInputError("Color must be #RRGGBB or null");
  return value.toUpperCase();
}

function icon(value: unknown): StatusIconToken | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !STATUS_ICON_TOKENS.includes(value as StatusIconToken)
  )
    throw new MasterInputError("Select a supported icon or none");
  return value as StatusIconToken;
}

export function normalizedName(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

export function normalizeStatusCreate(input: unknown) {
  const value = object(input, ["code", "name", "icon", "color"]);
  if (typeof value.code !== "string")
    throw new MasterInputError("Enter a status code");
  const rawCode = value.code.trim();
  const code = rawCode.toUpperCase();
  if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(rawCode) || !codePattern.test(code))
    throw new MasterInputError(
      "Code must start with A-Z and contain only A-Z, 0-9, or _ (up to 48 characters)",
    );
  return {
    code,
    name: name(value.name, 100),
    icon: value.icon === undefined ? null : icon(value.icon),
    color: value.color === undefined ? null : color(value.color),
  };
}

export function normalizeStatusPatch(input: unknown) {
  const value = object(input, ["name", "icon", "color", "active"]);
  return {
    ...(Object.hasOwn(value, "name") ? { name: name(value.name, 100) } : {}),
    ...(Object.hasOwn(value, "icon") ? { icon: icon(value.icon) } : {}),
    ...(Object.hasOwn(value, "color") ? { color: color(value.color) } : {}),
    ...(Object.hasOwn(value, "active") ? { active: active(value.active) } : {}),
  };
}

export function normalizeLocationCreate(input: unknown) {
  const value = object(input, ["name"]);
  return { name: name(value.name, 160) };
}

export function normalizeLocationPatch(input: unknown) {
  const value = object(input, ["name", "active"]);
  return {
    ...(Object.hasOwn(value, "name") ? { name: name(value.name, 160) } : {}),
    ...(Object.hasOwn(value, "active") ? { active: active(value.active) } : {}),
  };
}

export function normalizeStatusOrder(input: unknown): string[] {
  const value = object(input, ["ids"]);
  if (
    !Array.isArray(value.ids) ||
    value.ids.some((id) => typeof id !== "string" || !uuid.test(id))
  )
    throw new MasterInputError("Provide every active status ID exactly once");
  const ids = (value.ids as string[]).map((id) => id.toLowerCase());
  if (new Set(ids).size !== ids.length)
    throw new MasterInputError("Provide every active status ID exactly once");
  return ids;
}

export function normalizeMasterId(id: string): string | null {
  return uuid.test(id) ? id.toLowerCase() : null;
}
