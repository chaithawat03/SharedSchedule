export const STATUS_ICON_TOKENS = [
  "briefcase",
  "clock",
  "home",
  "calendar",
  "plane",
  "person",
  "pin",
  "star",
] as const;

export type StatusIconToken = (typeof STATUS_ICON_TOKENS)[number];
