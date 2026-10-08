import { normalizeBulkEventInput } from "../lib/events/bulk-validation";
import {
  EventInputError,
  isUuid,
  type EventValues,
} from "../lib/events/validation";
import { EventError, type EventRecord } from "./event.service";
import {
  NotificationService,
  type NotificationWriter,
} from "./notification.service";

type NewEvent = EventValues & {
  roomId: string;
  ownerUserId: string;
  createdBy: string;
};

export interface BulkEventTransaction {
  roomAccessForBulk(
    roomId: string,
    userId: string,
  ): Promise<{ active: boolean; memberActive: boolean } | null>;
  status(statusId: string): Promise<{ roomId: string; active: boolean } | null>;
  location(
    locationId: string,
  ): Promise<{ roomId: string; active: boolean } | null>;
  duplicateCandidates(
    roomId: string,
    ownerUserId: string,
    dates: string[],
  ): Promise<EventRecord[]>;
  insertMany(inputs: NewEvent[]): Promise<EventRecord[]>;
  auditCreates(events: EventRecord[]): Promise<void>;
  notificationWriter(): NotificationWriter;
}

export interface BulkEventRepository {
  bulkTransaction<T>(run: (tx: BulkEventTransaction) => Promise<T>): Promise<T>;
}

export class DuplicateBulkEventError extends Error {
  readonly code = "DUPLICATE_EVENT";
  constructor(public readonly conflictDates: string[]) {
    super("Matching events already exist on selected dates");
  }
}

function normalizedText(value: string | null): string | null {
  return value?.trim() || null;
}

function sameDomain(event: EventRecord, value: EventValues): boolean {
  return (
    event.startDate === value.startDate &&
    event.endDate === value.endDate &&
    event.statusId === value.statusId &&
    normalizedText(event.title) === value.title &&
    event.allDay === value.allDay &&
    (event.startTime?.slice(0, 5) ?? null) === value.startTime &&
    (event.endTime?.slice(0, 5) ?? null) === value.endTime &&
    event.endTimeOpen === value.endTimeOpen &&
    event.locationId === value.locationId &&
    normalizedText(event.locationText) === value.locationText &&
    normalizedText(event.note) === value.note
  );
}

export async function createBulkEvents(
  userId: string,
  roomId: string,
  input: unknown,
  repository: BulkEventRepository,
): Promise<EventRecord[]> {
  if (!isUuid(roomId))
    throw new EventError("NOT_FOUND", "Event or room not found");
  roomId = roomId.toLowerCase();
  return repository.bulkTransaction(async (tx) => {
    // The repository locks this room FOR UPDATE before reading membership. This
    // serializes bulk submissions for the room through duplicate detection.
    const access = await tx.roomAccessForBulk(roomId, userId);
    if (!access?.active || !access.memberActive)
      throw new EventError("NOT_FOUND", "Event or room not found");
    let values: EventValues[];
    try {
      values = normalizeBulkEventInput(input);
    } catch (error) {
      if (error instanceof EventInputError)
        throw new EventError("INVALID_INPUT", error.message);
      throw error;
    }
    const status = await tx.status(values[0].statusId);
    if (!status?.active || status.roomId !== roomId)
      throw new EventError(
        "INVALID_INPUT",
        "Select an active status from this room",
      );
    if (values[0].locationId) {
      const location = await tx.location(values[0].locationId);
      if (!location?.active || location.roomId !== roomId)
        throw new EventError(
          "INVALID_INPUT",
          "Select an active location from this room",
        );
    }
    const candidates = await tx.duplicateCandidates(
      roomId,
      userId,
      values.map((value) => value.startDate),
    );
    const conflictDates = values
      .filter((value) => candidates.some((event) => sameDomain(event, value)))
      .map((value) => value.startDate);
    if (conflictDates.length) throw new DuplicateBulkEventError(conflictDates);
    const created = await tx.insertMany(
      values.map((value) => ({
        ...value,
        roomId,
        ownerUserId: userId,
        createdBy: userId,
      })),
    );
    created.sort((a, b) => a.startDate.localeCompare(b.startDate));
    await tx.auditCreates(created);
    await NotificationService.publish(tx.notificationWriter(), {
      roomId,
      fromUserId: userId,
      eventId: null,
      type: "BULK_EVENTS_CREATED",
    });
    return created;
  });
}
