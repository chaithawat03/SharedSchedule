export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function monthDates(year: number, month: number): string[] {
  const prefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  return Array.from(
    { length: daysInMonth(year, month) },
    (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`,
  );
}

export function shiftMonth(year: number, month: number, delta: number) {
  const zeroBased = year * 12 + month - 1 + delta;
  return {
    year: Math.floor(zeroBased / 12),
    month: (((zeroBased % 12) + 12) % 12) + 1,
  };
}

export function weekdayMondayFirst(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  const weekday = utc.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function bangkokToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
