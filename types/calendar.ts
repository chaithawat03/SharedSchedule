export type CalendarBaseSchedule = {
  code: "WORK" | "OFF";
  startTime: string | null;
  endTime: string | null;
  source: "PATTERN" | "OVERRIDE";
  note: string | null;
};

export type CalendarEvent = {
  eventId: string;
  ownerUserId: string;
  statusId: string | null;
  code: string;
  statusName: string;
  statusIcon: string | null;
  statusColor: string | null;
  title: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  endTimeOpen: boolean;
  allDay: boolean;
  locationId: string | null;
  locationName: string | null;
  locationText: string | null;
  note: string | null;
};

export type CalendarMonth = {
  room: {
    id: string;
    name: string;
    description: string | null;
    ownerUserId: string;
    status: string;
  };
  currentUser: { id: string; displayName: string };
  members: {
    userId: string;
    displayName: string;
    avatarText: string | null;
    defaultColor: string | null;
  }[];
  statuses: {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    color: string | null;
    sortOrder: number;
  }[];
  locations: { id: string; name: string }[];
  year: number;
  month: number;
  monthStart: string;
  monthEnd: string;
  today: string;
  days: Record<
    string,
    {
      users: Record<
        string,
        { baseSchedule: CalendarBaseSchedule | null; events: CalendarEvent[] }
      >;
    }
  >;
};
