export const DEFAULT_STATUS_CODES = [
  "WORK",
  "OT",
  "OFF",
  "LEAVE",
  "WFH",
  "TRAVEL",
  "PERSONAL",
  "ACTIVITY",
  "OTHER",
] as const;

export function defaultStatusRows(roomId: string) {
  return DEFAULT_STATUS_CODES.map((code, sortOrder) => ({
    roomId,
    code,
    name: code,
    sortOrder,
  }));
}
