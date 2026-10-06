import type {
  CalendarBaseSchedule,
  CalendarEvent,
  CalendarMonth,
} from "../../types/calendar";

export function formatEventTiming(event: CalendarEvent): string {
  if (event.allDay) {
    return event.startDate === event.endDate
      ? "All day"
      : `All day · ${event.startDate} → ${event.endDate}`;
  }
  const end = event.endTime
    ? `${event.endTime}${event.endTimeOpen ? "+" : ""}`
    : "time open";
  if (event.startDate !== event.endDate) {
    return `Continuous span · ${event.startDate} ${event.startTime ?? "time open"} → ${event.endDate} ${end}`;
  }
  return event.startTime ? `${event.startTime}–${end}` : "Time unspecified";
}

function BaseSchedule({ schedule }: { schedule: CalendarBaseSchedule | null }) {
  if (!schedule)
    return <p className="text-sm text-[#6c8476]">No default schedule</p>;
  return (
    <div className="rounded-xl bg-[#eef5ef] p-3">
      <p className="font-semibold">
        {schedule.code === "WORK" ? "Work" : "Off"}
      </p>
      {schedule.startTime && schedule.endTime && (
        <p className="text-sm">
          {schedule.startTime}–{schedule.endTime}
        </p>
      )}
      <p className="text-xs text-[#567269]">
        {schedule.source === "OVERRIDE" ? "Date override" : "Weekly pattern"}
      </p>
      {schedule.note && (
        <p className="mt-1 break-words text-sm">{schedule.note}</p>
      )}
    </div>
  );
}

export function MemberScheduleLane({
  member,
  day,
}: {
  member: CalendarMonth["members"][number];
  day: CalendarMonth["days"][string]["users"][string];
}) {
  return (
    <section
      aria-label={`${member.displayName} schedule`}
      className="border-t border-[#dce8e0] py-4"
    >
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e0efe3] text-sm"
          aria-hidden="true"
        >
          {member.avatarText || member.displayName.charAt(0).toUpperCase()}
        </span>
        <span className="break-words">{member.displayName}</span>
      </h3>
      <BaseSchedule schedule={day.baseSchedule} />
      {day.events.length > 0 && (
        <ul className="mt-3 space-y-2">
          {day.events.map((event) => (
            <li
              key={event.eventId}
              className="rounded-xl border border-[#dce8e0] bg-white p-3"
            >
              <p className="font-semibold">
                {event.statusName}
                {event.title ? ` · ${event.title}` : ""}
              </p>
              <p className="mt-1 text-sm text-[#4a665c]">
                {formatEventTiming(event)}
              </p>
              {(event.locationText || event.locationName) && (
                <p className="mt-1 break-words text-sm">
                  {event.locationText || event.locationName}
                </p>
              )}
              {event.note && (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {event.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
