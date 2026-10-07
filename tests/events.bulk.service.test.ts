import { describe, expect, it } from "vitest";
import {
  createBulkEvents,
  type BulkEventRepository,
  type BulkEventTransaction,
} from "../services/bulk-event.service";
import type { EventRecord } from "../services/event.service";

const alice = "10000000-0000-4000-8000-000000000001";
const owner = "10000000-0000-4000-8000-000000000002";
const room = "20000000-0000-4000-8000-000000000001";
const otherRoom = "20000000-0000-4000-8000-000000000002";
const status = "30000000-0000-4000-8000-000000000001";
const otherStatus = "30000000-0000-4000-8000-000000000002";
const foreignStatus = "30000000-0000-4000-8000-000000000003";
const location = "40000000-0000-4000-8000-000000000001";
const otherLocation = "40000000-0000-4000-8000-000000000002";
const foreignLocation = "40000000-0000-4000-8000-000000000003";
const request = {
  dates: ["2026-10-11", "2026-10-04"],
  event: { statusId: status, allDay: true, title: "Shift" },
};

function fixture() {
  const rows: EventRecord[] = [];
  const audits: EventRecord[] = [];
  const members = new Set([alice]);
  const statuses = new Map([
    [status, { roomId: room, active: true }],
    [otherStatus, { roomId: room, active: true }],
    [foreignStatus, { roomId: otherRoom, active: true }],
  ]);
  const locations = new Map([
    [location, { roomId: room, active: true }],
    [otherLocation, { roomId: room, active: true }],
    [foreignLocation, { roomId: otherRoom, active: true }],
  ]);
  let roomActive = true;
  let failAudit = false;
  let next = 0;
  const repository: BulkEventRepository = {
    async bulkTransaction(run) {
      const beforeRows = rows.length;
      const beforeAudits = audits.length;
      const tx: BulkEventTransaction = {
        async roomAccessForBulk(roomId, userId) {
          return roomId === room
            ? { active: roomActive, memberActive: members.has(userId) }
            : null;
        },
        async status(id) {
          return statuses.get(id) ?? null;
        },
        async location(id) {
          return locations.get(id) ?? null;
        },
        async duplicateCandidates(roomId, userId, dates) {
          return rows.filter(
            (row) =>
              row.roomId === roomId &&
              row.ownerUserId === userId &&
              dates.includes(row.startDate) &&
              row.startDate === row.endDate &&
              !row.deletedAt,
          );
        },
        async insertMany(inputs) {
          const created = inputs.map((input) => ({
            ...input,
            id: `60000000-0000-4000-8000-${String(++next).padStart(12, "0")}`,
            createdAt: new Date("2026-10-01T00:00:00Z"),
            updatedAt: new Date("2026-10-01T00:00:00Z"),
            deletedAt: null,
          }));
          rows.push(...created);
          return created;
        },
        async auditCreates(created) {
          if (failAudit) throw new Error("audit failed");
          audits.push(...created);
        },
      };
      try {
        return await run(tx);
      } catch (error) {
        rows.length = beforeRows;
        audits.length = beforeAudits;
        throw error;
      }
    },
  };
  return {
    repository,
    rows,
    audits,
    members,
    statuses,
    locations,
    deactivateRoom: () => {
      roomActive = false;
    },
    failAudit: () => {
      failAudit = true;
    },
  };
}

describe("bulk event service", () => {
  it("creates one ordered single-day event and audit per date with session ownership", async () => {
    const f = fixture();
    const created = await createBulkEvents(alice, room, request, f.repository);
    expect(created.map((event) => [event.startDate, event.endDate])).toEqual([
      ["2026-10-04", "2026-10-04"],
      ["2026-10-11", "2026-10-11"],
    ]);
    expect(
      created.every(
        (event) => event.ownerUserId === alice && event.createdBy === alice,
      ),
    ).toBe(true);
    expect(f.audits).toEqual(created);
  });

  it("requires an active room and active participant, including when the user owns the room", async () => {
    const f = fixture();
    for (const user of [owner, "10000000-0000-4000-8000-000000000003"]) {
      await expect(
        createBulkEvents(user, room, request, f.repository),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    f.members.delete(alice);
    await expect(
      createBulkEvents(alice, room, request, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.members.add(alice);
    f.deactivateRoom();
    await expect(
      createBulkEvents(alice, room, request, f.repository),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.rows).toHaveLength(0);
  });

  it("rejects cross-room and inactive references before writing", async () => {
    const f = fixture();
    f.statuses.set(otherStatus, { roomId: room, active: false });
    f.locations.set(otherLocation, { roomId: room, active: false });
    for (const statusId of [otherStatus, foreignStatus]) {
      await expect(
        createBulkEvents(
          alice,
          room,
          { ...request, event: { ...request.event, statusId } },
          f.repository,
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    for (const locationId of [otherLocation, foreignLocation]) {
      await expect(
        createBulkEvents(
          alice,
          room,
          { ...request, event: { ...request.event, locationId } },
          f.repository,
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    expect(f.rows).toHaveLength(0);
    expect(f.audits).toHaveLength(0);
  });

  it("returns sorted conflicts and creates nothing when any selected date matches exactly", async () => {
    const f = fixture();
    await createBulkEvents(alice, room, request, f.repository);
    const originalCount = f.rows.length;
    await expect(
      createBulkEvents(alice, room, request, f.repository),
    ).rejects.toMatchObject({
      code: "DUPLICATE_EVENT",
      conflictDates: ["2026-10-04", "2026-10-11"],
    });
    expect(f.rows).toHaveLength(originalCount);
    expect(f.audits).toHaveLength(originalCount);
    await expect(
      createBulkEvents(
        alice,
        room,
        {
          ...request,
          dates: ["2026-10-04", "2026-10-12"],
        },
        f.repository,
      ),
    ).rejects.toMatchObject({ conflictDates: ["2026-10-04"] });
    expect(f.rows).toHaveLength(originalCount);
  });

  it("allows different event-domain fields and ignores a soft-deleted identical event", async () => {
    const f = fixture();
    await createBulkEvents(
      alice,
      room,
      { ...request, dates: ["2026-10-04"] },
      f.repository,
    );
    const variants = [
      { ...request.event, statusId: otherStatus },
      { ...request.event, title: "Different" },
      { ...request.event, note: "Different" },
      { ...request.event, locationId: location },
      { ...request.event, locationText: "Custom" },
      { ...request.event, allDay: false, startTime: "07:40", endTime: "17:00" },
      { ...request.event, allDay: false, startTime: "08:00", endTime: "17:00" },
    ];
    for (const event of variants) {
      await expect(
        createBulkEvents(
          alice,
          room,
          { dates: ["2026-10-04"], event },
          f.repository,
        ),
      ).resolves.toHaveLength(1);
    }
    f.rows[0].deletedAt = new Date();
    await expect(
      createBulkEvents(
        alice,
        room,
        { ...request, dates: ["2026-10-04"] },
        f.repository,
      ),
    ).resolves.toHaveLength(1);
  });

  it("rolls back every event if auditing fails", async () => {
    const f = fixture();
    f.failAudit();
    await expect(
      createBulkEvents(alice, room, request, f.repository),
    ).rejects.toThrow("audit failed");
    expect(f.rows).toHaveLength(0);
    expect(f.audits).toHaveLength(0);
  });

  it("writes no rows when one requested date is invalid", async () => {
    const f = fixture();
    await expect(
      createBulkEvents(
        alice,
        room,
        {
          ...request,
          dates: ["2026-10-04", "2026-10-32"],
        },
        f.repository,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(f.rows).toHaveLength(0);
    expect(f.audits).toHaveLength(0);
  });
});
