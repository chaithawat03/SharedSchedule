export class InvalidPhoneError extends Error {
  constructor() {
    super("Enter a valid Thai mobile number");
  }
}

export type ThaiPhone = {
  normalized: string;
  display: string;
};

export function parseThaiPhone(input: unknown): ThaiPhone {
  if (typeof input !== "string") throw new InvalidPhoneError();

  const compact = input.trim().replace(/[\s()-]/g, "");
  const display = compact.startsWith("0")
    ? compact
    : `0${compact.replace(/^\+?66/, "")}`;

  if (!/^0[689]\d{8}$/.test(display)) throw new InvalidPhoneError();

  return { normalized: `+66${display.slice(1)}`, display };
}
