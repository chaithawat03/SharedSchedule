import {
  EventInputError,
  isUuid,
  normalizeEventValues,
  type EventValues,
} from "../lib/events/validation";

export type EventRecord = EventValues & {
  id: string;
  roomId: string;
  ownerUserId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export interface EventTransaction {
  roomAccess(
    roomId: string,
    userId: string,
  ): Promise<{ active: boolean; memberActive: boolean } | null>;
  event(eventId: string): Promise<EventRecord | null>;
  status(statusId: string): Promise<{ roomId: string; active: boolean } | null>;
  location(
    locationId: string,
  ): Promise<{ roomId: string; active: boolean } | null>;
  insert(
    input: EventValues & {
      roomId: string;
      ownerUserId: string;
      createdBy: string;
    },
  ): Promise<EventRecord>;
  replace(
    before: EventRecord,
    values: EventValues,
    at: Date,
  ): Promise<EventRecord>;
  softDelete(before: EventRecord, at: Date): Promise<EventRecord>;
  audit(
    action: "CREATE_EVENT" | "UPDATE_EVENT" | "DELETE_EVENT",
    oldValue: EventRecord | null,
    newValue: EventRecord,
  ): Promise<void>;
}

export interface EventRepository {
  transaction<T>(run: (tx: EventTransaction) => Promise<T>): Promise<T>;
}

export class EventError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

function invalid(message: string): never {
  throw new EventError("INVALID_INPUT", message);
}
function notFound(): never {
  throw new EventError("NOT_FOUND", "Event or room not found");
}

function valuesOf(event: EventRecord): EventValues {
  return {
    statusId: event.statusId,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime?.slice(0, 5) ?? null,
    endTime: event.endTime?.slice(0, 5) ?? null,
    endTimeOpen: event.endTimeOpen,
    allDay: event.allDay,
    locationId: event.locationId,
    locationText: event.locationText,
    note: event.note,
  };
}

function normalize(input: unknown, existing?: EventValues): EventValues {
  try {
    return normalizeEventValues(input, existing);
  } catch (error) {
    if (error instanceof EventInputError) invalid(error.message);
    throw error;
  }
}

async function references(
  tx: EventTransaction,
  roomId: string,
  values: EventValues,
  before?: EventRecord,
) {
  const status = await tx.status(values.statusId);
  if (
    !status ||
    status.roomId !== roomId ||
    (!status.active && values.statusId !== before?.statusId)
  )
    invalid("Select an active status from this room");
  if (values.locationId) {
    const location = await tx.location(values.locationId);
    if (
      !location ||
      location.roomId !== roomId ||
      (!location.active && values.locationId !== before?.locationId)
    )
      invalid("Select an active location from this room");
  }
}

async function ownActiveEvent(
  tx: EventTransaction,
  userId: string,
  eventId: string,
): Promise<EventRecord> {
  if (!isUuid(eventId)) notFound();
  const event = await tx.event(eventId);
  if (!event || event.deletedAt) notFound();
  const access = await tx.roomAccess(event.roomId, userId);
  if (!access?.active || !access.memberActive) notFound();
  if (event.ownerUserId !== userId) {
    const ownerAccess = await tx.roomAccess(event.roomId, event.ownerUserId);
    if (!ownerAccess?.memberActive) notFound();
  }
  if (event.ownerUserId !== userId)
    throw new EventError("FORBIDDEN", "You can change only your own events");
  return event;
}

export async function createEvent(
  userId: string,
  roomId: string,
  input: unknown,
  repository: EventRepository,
): Promise<EventRecord> {
  if (!isUuid(roomId)) notFound();
  roomId = roomId.toLowerCase();
  return repository.transaction(async (tx) => {
    const access = await tx.roomAccess(roomId, userId);
    if (!access?.active || !access.memberActive) notFound();
    const values = normalize(input);
    await references(tx, roomId, values);
    const event = await tx.insert({
      ...values,
      roomId,
      ownerUserId: userId,
      createdBy: userId,
    });
    await tx.audit("CREATE_EVENT", null, event);
    return event;
  });
}

export async function updateEvent(
  userId: string,
  eventId: string,
  patch: unknown,
  repository: EventRepository,
  now = new Date(),
): Promise<EventRecord> {
  return repository.transaction(async (tx) => {
    const event = await ownActiveEvent(tx, userId, eventId);
    const before = valuesOf(event);
    const after = normalize(patch, before);
    await references(tx, event.roomId, after, event);
    if (JSON.stringify(before) === JSON.stringify(after)) return event;
    const updated = await tx.replace(event, after, now);
    await tx.audit("UPDATE_EVENT", event, updated);
    return updated;
  });
}

export async function deleteEvent(
  userId: string,
  eventId: string,
  repository: EventRepository,
  now = new Date(),
): Promise<EventRecord> {
  return repository.transaction(async (tx) => {
    const event = await ownActiveEvent(tx, userId, eventId);
    const deleted = await tx.softDelete(event, now);
    await tx.audit("DELETE_EVENT", event, deleted);
    return deleted;
  });
}
