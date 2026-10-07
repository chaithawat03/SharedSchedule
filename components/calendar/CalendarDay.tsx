import type { CalendarMonth } from "../../types/calendar";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function calendarDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${monthNames[month - 1]} ${day}, ${year}`;
}

export function CalendarDay({
  date,
  model,
  onOpen,
  selectionMode = false,
  selected = false,
}: {
  date: string;
  model: CalendarMonth;
  onOpen: (date: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
}) {
  const users = model.days[date]?.users ?? {};
  const summaries = model.members.flatMap((member) => {
    const schedule = users[member.userId];
    if (!schedule) return [];
    const initial = (member.avatarText || member.displayName.charAt(0))
      .charAt(0)
      .toUpperCase();
    return [
      ...(schedule.baseSchedule
        ? [`${initial} ${schedule.baseSchedule.code}`]
        : []),
      ...schedule.events.map((event) => `${initial} ${event.code}`),
    ];
  });
  const day = Number(date.slice(-2));
  return (
    <button
      type="button"
      onClick={() => onOpen(date)}
      aria-label={`${selectionMode ? "Select" : "Open"} ${calendarDateLabel(date)}`}
      aria-pressed={selectionMode ? selected : undefined}
      aria-current={date === model.today ? "date" : undefined}
      className={`flex min-h-[74px] min-w-0 flex-col overflow-hidden rounded-lg border px-0.5 py-1 text-left text-[#18332f] active:bg-[#e9f3ec] focus-visible:outline-2 focus-visible:outline-[#397c61] ${selected ? "border-[#205545] bg-[#d2ebdb] ring-2 ring-[#205545]" : "border-[#dce8e0] bg-white"}`}
    >
      <span
        className={`mx-0.5 text-xs font-semibold ${date === model.today ? "rounded-full bg-[#276451] px-1 text-white" : ""}`}
      >
        {day}
      </span>
      {summaries.slice(0, 2).map((summary, index) => (
        <span
          key={`${summary}-${index}`}
          className="block w-full truncate rounded bg-[#eef5ef] px-0.5 text-[9px] leading-4"
        >
          {summary}
        </span>
      ))}
      {summaries.length > 2 && (
        <span className="px-0.5 text-[9px] font-semibold text-[#397c61]">
          +{summaries.length - 2}
        </span>
      )}
    </button>
  );
}
