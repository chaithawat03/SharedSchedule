import { parseThaiPhone } from "../phone";

export class SessionInputError extends Error {}

export function parseLoginInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SessionInputError("Enter a phone number");
  }

  const body = input as Record<string, unknown>;
  const phone = parseThaiPhone(body.phone);
  if (body.displayName !== undefined && typeof body.displayName !== "string") {
    throw new SessionInputError("Enter a display name");
  }

  return { phone, displayName: body.displayName as string | undefined };
}

export function validateDisplayName(input: string | undefined): string {
  const name = input?.trim() ?? "";
  if (!name || name.length > 120 || /[\x00-\x1f\x7f]/.test(name)) {
    throw new SessionInputError("Enter a display name (up to 120 characters)");
  }
  return name;
}
