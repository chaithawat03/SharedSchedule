import { describe, expect, it } from "vitest";
import {
  createEvent,
  deleteEvent,
  updateEvent,
  type EventRecord,
  type EventRepository,
  type EventTransaction,
} from "../services/event.service";

const alice = "10000000-0000-4000-8000-000000000001";
const bob = "10000000-0000-4000-8000-000000000002";
const stranger = "10000000-0000-4000-8000-000000000003";
const room = "20000000-0000-4000-8000-000000000001";
const otherRoom = "20000000-0000-4000-8000-000000000002";
const activeStatus = "30000000-0000-4000-8000-000000000001";
const inactiveStatus = "30000000-0000-4000-8000-000000000002";
const foreignStatus = "30000000-0000-4000-8000-000000000003";
const activeLocation = "40000000-0000-4000-8000-000000000001";
const inactiveLocation = "40000000-0000-4000-8000-000000000002";
const foreignLocation = "40000000-0000-4000-8000-000000000003";
const payload = {
  statusId: activeStatus,
  startDate: "2026-10-12",
  endDate: "2026-10-12",
  allDay: true,
  title: "Shift",
};

function fixture() {
  const rows = new Map<string, EventRecord>();
  const notifications: {
    toUserId: string;
    type: string;
    eventId: string | null;
  }[] = [];
  let failNotification = false;
  const audit: {
    action: string;
    oldValue: EventRecord | null;
    newValue: EventRecord;
  }[] = [];
  const members = new Set([alice, bob]);
  const statuses = new Map([
    [activeStatus, { roomId: room, active: true }],
    [inactiveStatus, { roomId: room, active: false }],
    [foreignStatus, { roomId: otherRoom, active: true }],
  ]);
  const locations = new Map([
    [activeLocation, { roomId: room, active: true }],
    [inactiveLocation, { roomId: room, active: false }],
    [foreignLocation, { roomId: otherRoom, active: true }],
  ]);
  let next = 1;
  const tx: EventTransaction = {
    async roomAccess(roomId, userId) {
      return roomId === room
        ? { active: true, memberActive: members.has(userId) }
        : null;
    },
    async event(eventId) {
      return rows.get(eventId) ?? null;
    },
    async status(statusId) {
      return statuses.get(statusId) ?? null;
    },
    async location(locationId) {
      return locations.get(locationId) ?? null;
    },
    async insert(input) {
      const at = new Date("2026-10-06T00:00:00Z");
      const event: EventRecord = {
        ...input,
        id: `60000000-0000-4000-8000-${String(next++).padStart(12, "0")}`,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      };
      rows.set(event.id, event);
      return event;
    },
    async replace(before, values, at) {
      const event = { ...before, ...values, updatedAt: at };
      rows.set(event.id, event);
      return event;
    },
    async softDelete(before, at) {
      const event = { ...before, updatedAt: at, deletedAt: at };
      rows.set(event.id, event);
      return event;
    },
    async audit(action, oldValue, newValue) {
      audit.push({ action, oldValue, newValue });
    },
    notificationWriter() {
      return {
        recipients: async () => [alice, bob, bob],
        insert: async (
          values: { toUserId: string; type: string; eventId: string | null }[],
        ) => {
          if (failNotification) throw new Error("notification failed");
          notifications.push(...values);
        },
      };
    },
  };
  const repository: EventRepository = {
    transaction: async (run) => {
      const beforeRows = new Map(rows);
      const beforeAudits = audit.length;
      const beforeNotifications = notifications.length;
      try {
        return await run(tx);
      } catch (error) {
        rows.clear();
        for (const [id, row] of beforeRows) rows.set(id, row);
        audit.length = beforeAudits;
        notifications.length = beforeNotifications;
        throw error;
      }
    },
  };
  return {
    repository,
    rows,
    audit,
    notifications,
    members,
    statuses,
    locations,
    failNotification: () => {
      failNotification = true;
    },
  };
}

describe("event service", () => {
  it("notifies other participants only after changed event writes", async () => {
    const f = fixture();
    const event = await createEvent(alice, room, payload, f.repository);
    await updateEvent(alice, event.id, { title: " Shift " }, f.repository);
    await updateEvent(alice, event.id, { title: "New" }, f.repository);
    await deleteEvent(alice, event.id, f.repository);
    expect(
      f.notifications.map(({ toUserId, type, eventId }) => ({
        toUserId,
        type,
        eventId,
      })),
    ).toEqual([
      { toUserId: bob, type: "EVENT_CREATED", eventId: event.id },
      { toUserId: bob, type: "EVENT_UPDATED", eventId: event.id },
      { toUserId: bob, type: "EVENT_DELETED", eventId: event.id },
    ]);
  });
  it("rolls back an event and audit when notification insertion fails", async () => {
    const f = fixture();
    f.failNotification();
    await expect(
      createEvent(alice, room, payload, f.repository),
    ).rejects.toThrow("notification failed");
    expect(f.rows.size).toBe(0);
    expect(f.audit).toHaveLength(0);
    expect(f.notifications).toHaveLength(0);
  });
  it("creates only for an active participant and sets immutable ownership from session", async () => {
    const f = fixture();
    const event = await createEvent(alice, room, payload, f.repository);
    expect(event).toMatchObject({
      ownerUserId: alice,
      createdBy: alice,
      roomId: room,
      title: "Shift",
    });
    expect(f.audit).toMatchObject([
      { action: "CREATE_EVENT", oldValue: null, newValue: event },
    ]);
    f.members.delete(alice);
    await expect(
      createEvent(alice, room, payload, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createEvent(stranger, room, payload, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects foreign and inactive references on create or new selection", async () => {
    const f = fixture();
    for (const statusId of [foreignStatus, inactiveStatus]) {
      await expect(
        createEvent(alice, room, { ...payload, statusId }, f.repository),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    for (const locationId of [foreignLocation, inactiveLocation]) {
      await expect(
        createEvent(alice, room, { ...payload, locationId }, f.repository),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    expect(f.rows.size).toBe(0);
    expect(f.audit).toHaveLength(0);
  });

  it("rejects other participants and strangers without exposing unrelated events", async () => {
    const f = fixture();
    const event = await createEvent(alice, room, payload, f.repository);
    await expect(
      updateEvent(bob, event.id, { title: "Hack" }, f.repository),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      deleteEvent(bob, event.id, f.repository),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      updateEvent(stranger, event.id, { title: "Probe" }, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      deleteEvent(stranger, event.id, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.audit).toHaveLength(1);
  });

  it("does not expose an inactive owner's event to another participant", async () => {
    const f = fixture();
    const event = await createEvent(alice, room, payload, f.repository);
    f.members.delete(alice);
    await expect(
      updateEvent(bob, event.id, { title: "Probe" }, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates the complete effective patch and preserves unchanged inactive references", async () => {
    const f = fixture();
    const event = await createEvent(
      alice,
      room,
      { ...payload, locationId: activeLocation },
      f.repository,
    );
    f.rows.set(event.id, {
      ...event,
      statusId: inactiveStatus,
      locationId: inactiveLocation,
    });
    const updated = await updateEvent(
      alice,
      event.id,
      { title: " New title " },
      f.repository,
    );
    expect(updated).toMatchObject({
      title: "New title",
      statusId: inactiveStatus,
      locationId: inactiveLocation,
    });
    await expect(
      updateEvent(alice, event.id, { statusId: foreignStatus }, f.repository),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      updateEvent(
        alice,
        event.id,
        { locationId: inactiveLocation, locationText: "Other" },
        f.repository,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      updateEvent(alice, event.id, { allDay: false }, f.repository),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      updateEvent(alice, event.id, { ownerUserId: bob }, f.repository),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(f.audit).toHaveLength(2);
  });

  it("avoids no-op audit and soft-deletes once with a deleted snapshot", async () => {
    const f = fixture();
    const event = await createEvent(alice, room, payload, f.repository);
    await updateEvent(alice, event.id, { title: " Shift " }, f.repository);
    expect(f.audit).toHaveLength(1);
    const deleted = await deleteEvent(alice, event.id, f.repository);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(f.audit[1]).toMatchObject({
      action: "DELETE_EVENT",
      oldValue: event,
      newValue: deleted,
    });
    await expect(
      deleteEvent(alice, event.id, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateEvent(alice, event.id, { title: "Again" }, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
