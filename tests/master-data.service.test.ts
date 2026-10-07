import { describe, expect, it } from "vitest";
import {
  createStatus,
  deleteStatus,
  listStatuses,
  patchStatus,
  putStatusOrder,
  createLocation,
  patchLocation,
  deleteLocation,
  listLocations,
  type MasterRepository,
  type StatusRow,
  type LocationRow,
} from "../services/master-data.service";

const owner = "10000000-0000-4000-8000-000000000001";
const member = "10000000-0000-4000-8000-000000000002";
const outsider = "10000000-0000-4000-8000-000000000003";
const room = "20000000-0000-4000-8000-000000000001";
const statusA = "30000000-0000-4000-8000-000000000001";
const statusB = "30000000-0000-4000-8000-000000000002";
const statusC = "30000000-0000-4000-8000-000000000003";
const locationA = "40000000-0000-4000-8000-000000000001";
const at = new Date("2026-10-07T00:00:00Z");

function fixture() {
  const statuses: StatusRow[] = [
    {
      id: statusA,
      roomId: room,
      code: "WORK",
      name: "Work",
      icon: null,
      color: null,
      sortOrder: 0,
      active: true,
      createdAt: at,
    },
    {
      id: statusB,
      roomId: room,
      code: "OT",
      name: "Overtime",
      icon: null,
      color: null,
      sortOrder: 1,
      active: true,
      createdAt: at,
    },
  ];
  const locations: LocationRow[] = [
    { id: locationA, roomId: room, name: "MCP", active: true, createdAt: at },
  ];
  const audits: {
    action: string;
    entityType: string;
    entityId: string;
    oldValue: unknown;
    newValue: unknown;
    userId: string;
    roomId: string;
  }[] = [];
  let nextId = 3;
  let roomStatus = "ACTIVE";
  const access = (roomId: string) =>
    roomId === room
      ? { id: room, ownerUserId: owner, status: roomStatus, memberActive: true }
      : null;
  const repo: MasterRepository = {
    async readAccess(roomId) {
      return access(roomId);
    },
    async readStatuses(roomId) {
      return statuses.filter((row) => row.roomId === roomId);
    },
    async readLocations(roomId) {
      return locations.filter((row) => row.roomId === roomId);
    },
    async transaction(run) {
      const previous = structuredClone({ statuses, locations, audits });
      try {
        return await run({
          async lockRoom(roomId) {
            return access(roomId);
          },
          async statuses() {
            return statuses;
          },
          async locations() {
            return locations;
          },
          async status(id) {
            return (
              statuses.find((row) => row.id === id && row.roomId === room) ??
              null
            );
          },
          async location(id) {
            return (
              locations.find((row) => row.id === id && row.roomId === room) ??
              null
            );
          },
          async insertStatus(values) {
            const row = {
              ...values,
              id: `30000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
              roomId: room,
              createdAt: at,
            };
            statuses.push(row);
            return row;
          },
          async updateStatus(id, values) {
            const index = statuses.findIndex((row) => row.id === id);
            statuses[index] = { ...statuses[index], ...values };
            return statuses[index];
          },
          async insertLocation(values) {
            const row = {
              ...values,
              id: `40000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
              roomId: room,
              createdAt: at,
            };
            locations.push(row);
            return row;
          },
          async updateLocation(id, values) {
            const index = locations.findIndex((row) => row.id === id);
            locations[index] = { ...locations[index], ...values };
            return locations[index];
          },
          async audit(row) {
            audits.push(row);
          },
        });
      } catch (error) {
        statuses.splice(0, statuses.length, ...previous.statuses);
        locations.splice(0, locations.length, ...previous.locations);
        audits.splice(0, audits.length, ...previous.audits);
        throw error;
      }
    },
  };
  return {
    repo,
    statuses,
    locations,
    audits,
    setRoomStatus(value: string) {
      roomStatus = value;
    },
  };
}

describe("room master service", () => {
  it("uses room ownership, not participant role or membership, for management", async () => {
    const f = fixture();
    await expect(
      createStatus(member, room, { code: "A", name: "A" }, f.repo),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createStatus(
        outsider,
        "20000000-0000-4000-8000-000000000099",
        { code: "A", name: "A" },
        f.repo,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (await createStatus(owner, room, { code: "home", name: "Home" }, f.repo))
        .code,
    ).toBe("HOME");
    f.setRoomStatus("INACTIVE");
    await expect(
      createStatus(owner, room, { code: "B", name: "B" }, f.repo),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides inactive choices from participants and gates inactive lists", async () => {
    const f = fixture();
    f.statuses[1].active = false;
    f.locations[0].active = false;
    expect(
      (await listStatuses(member, room, false, f.repo)).map((row) => row.code),
    ).toEqual(["WORK"]);
    expect(await listLocations(member, room, false, f.repo)).toEqual([]);
    await expect(
      listStatuses(member, room, true, f.repo),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      listLocations(member, room, true, f.repo),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await listStatuses(owner, room, true, f.repo)).toHaveLength(2);
  });

  it("rejects duplicate names and codes including inactive rows", async () => {
    const f = fixture();
    f.statuses[1].active = false;
    await expect(
      createStatus(owner, room, { code: "ot", name: "New" }, f.repo),
    ).rejects.toMatchObject({ code: "DUPLICATE" });
    await expect(
      createStatus(owner, room, { code: "NEW", name: " overtime " }, f.repo),
    ).rejects.toMatchObject({ code: "DUPLICATE" });
    f.locations[0].active = false;
    await expect(
      createLocation(owner, room, { name: " mcp " }, f.repo),
    ).rejects.toMatchObject({ code: "DUPLICATE" });
  });

  it("protects the last active status, appends reactivation, and protects built-in DELETE", async () => {
    const f = fixture();
    await patchStatus(owner, room, statusA, { active: false }, f.repo);
    await expect(
      patchStatus(owner, room, statusB, { active: false }, f.repo),
    ).rejects.toMatchObject({ code: "LAST_ACTIVE_STATUS" });
    await expect(
      deleteStatus(owner, room, statusA, f.repo),
    ).rejects.toMatchObject({ code: "PROTECTED" });
    const result = await patchStatus(
      owner,
      room,
      statusA,
      { active: true, name: "Factory Shift" },
      f.repo,
    );
    expect(result).toMatchObject({
      code: "WORK",
      name: "Factory Shift",
      sortOrder: 2,
      active: true,
    });
    expect(f.audits.map((row) => row.action)).toEqual([
      "DEACTIVATE_STATUS",
      "REACTIVATE_STATUS",
    ]);
  });

  it("reorders all active statuses atomically and suppresses normalized no-ops", async () => {
    const f = fixture();
    expect(
      (
        await putStatusOrder(owner, room, { ids: [statusB, statusA] }, f.repo)
      ).map((row) => [row.id, row.sortOrder]),
    ).toEqual([
      [statusB, 0],
      [statusA, 1],
    ]);
    expect(
      f.audits.filter((row) => row.action === "REORDER_STATUSES"),
    ).toHaveLength(1);
    expect(f.audits[0]).toMatchObject({
      userId: owner,
      roomId: room,
      entityType: "STATUS_ORDER",
      entityId: room,
      oldValue: [
        { id: statusA, sortOrder: 0 },
        { id: statusB, sortOrder: 1 },
      ],
      newValue: [
        { id: statusB, sortOrder: 0 },
        { id: statusA, sortOrder: 1 },
      ],
    });
    await putStatusOrder(owner, room, { ids: [statusB, statusA] }, f.repo);
    expect(
      f.audits.filter((row) => row.action === "REORDER_STATUSES"),
    ).toHaveLength(1);
    for (const ids of [
      [statusA],
      [statusA, statusA],
      [statusA, statusB, statusC],
    ])
      await expect(
        putStatusOrder(owner, room, { ids }, f.repo),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("deactivates custom statuses and locations without physical deletion or no-op audits", async () => {
    const f = fixture();
    const custom = await createStatus(
      owner,
      room,
      { code: "TRAINING", name: "Training" },
      f.repo,
    );
    await deleteStatus(owner, room, custom.id, f.repo);
    await deleteStatus(owner, room, custom.id, f.repo);
    expect(f.statuses.find((row) => row.id === custom.id)?.active).toBe(false);
    expect(
      f.audits.filter((row) => row.action === "DEACTIVATE_STATUS"),
    ).toHaveLength(1);
    await deleteLocation(owner, room, locationA, f.repo);
    await deleteLocation(owner, room, locationA, f.repo);
    expect(f.locations).toHaveLength(1);
    expect(
      f.audits.filter((row) => row.action === "DEACTIVATE_LOCATION"),
    ).toHaveLength(1);
    expect(
      (
        await patchLocation(
          owner,
          room,
          locationA,
          { active: true, name: "Main Office" },
          f.repo,
        )
      ).name,
    ).toBe("Main Office");
  });

  it("returns 404 for foreign IDs, orders active locations, and skips no-op audits", async () => {
    const f = fixture();
    const before = f.audits.length;
    await patchStatus(owner, room, statusA, { name: " Work " }, f.repo);
    await patchLocation(owner, room, locationA, { name: " MCP " }, f.repo);
    expect(f.audits).toHaveLength(before);
    await expect(
      patchStatus(owner, room, statusC, { name: "Hidden" }, f.repo),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      patchLocation(
        owner,
        room,
        "40000000-0000-4000-8000-000000000099",
        { name: "Hidden" },
        f.repo,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await createLocation(owner, room, { name: "Branch B" }, f.repo);
    await createLocation(owner, room, { name: "airport" }, f.repo);
    expect(
      (await listLocations(member, room, false, f.repo)).map((row) => row.name),
    ).toEqual(["airport", "Branch B", "MCP"]);
  });

  it("audits persisted before and after rows with explicit actions", async () => {
    const f = fixture();
    const createdStatus = await createStatus(
      owner,
      room,
      { code: "NIGHT", name: "Night", color: "#112233" },
      f.repo,
    );
    expect(createdStatus.sortOrder).toBe(2);
    expect(f.audits[0]).toMatchObject({
      action: "CREATE_STATUS",
      userId: owner,
      roomId: room,
      entityId: createdStatus.id,
      oldValue: null,
      newValue: createdStatus,
    });
    const renamedStatus = await patchStatus(
      owner,
      room,
      createdStatus.id,
      { name: "Night Shift" },
      f.repo,
    );
    expect(f.audits[1]).toMatchObject({
      action: "UPDATE_STATUS",
      oldValue: createdStatus,
      newValue: renamedStatus,
    });
    const createdLocation = await createLocation(
      owner,
      room,
      { name: "Depot" },
      f.repo,
    );
    expect(f.audits[2]).toMatchObject({
      action: "CREATE_LOCATION",
      oldValue: null,
      newValue: createdLocation,
    });
    const renamedLocation = await patchLocation(
      owner,
      room,
      createdLocation.id,
      { name: "Main Depot" },
      f.repo,
    );
    expect(f.audits[3]).toMatchObject({
      action: "UPDATE_LOCATION",
      oldValue: createdLocation,
      newValue: renamedLocation,
    });
  });
});
