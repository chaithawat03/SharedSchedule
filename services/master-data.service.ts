import { DEFAULT_STATUS_CODES } from "../lib/rooms/default-statuses";
import {
  MasterInputError,
  normalizedName,
  normalizeLocationCreate,
  normalizeLocationPatch,
  normalizeMasterId,
  normalizeStatusCreate,
  normalizeStatusOrder,
  normalizeStatusPatch,
} from "../lib/master-data/validation";

export type StatusRow = {
  id: string;
  roomId: string;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
};

export type LocationRow = {
  id: string;
  roomId: string;
  name: string;
  active: boolean;
  createdAt: Date;
};

export type MasterRoomAccess = {
  id: string;
  ownerUserId: string;
  status: string;
  memberActive: boolean;
};

export type MasterAudit = {
  userId: string;
  roomId: string;
  action:
    | "CREATE_STATUS"
    | "UPDATE_STATUS"
    | "DEACTIVATE_STATUS"
    | "REACTIVATE_STATUS"
    | "REORDER_STATUSES"
    | "CREATE_LOCATION"
    | "UPDATE_LOCATION"
    | "DEACTIVATE_LOCATION"
    | "REACTIVATE_LOCATION";
  entityType: "STATUS" | "LOCATION" | "STATUS_ORDER";
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
};

export interface MasterTransaction {
  lockRoom(roomId: string, userId: string): Promise<MasterRoomAccess | null>;
  statuses(): Promise<StatusRow[]>;
  locations(): Promise<LocationRow[]>;
  status(id: string): Promise<StatusRow | null>;
  location(id: string): Promise<LocationRow | null>;
  insertStatus(
    values: Pick<
      StatusRow,
      "code" | "name" | "icon" | "color" | "active" | "sortOrder"
    >,
  ): Promise<StatusRow>;
  updateStatus(
    id: string,
    values: Partial<
      Pick<StatusRow, "name" | "icon" | "color" | "active" | "sortOrder">
    >,
  ): Promise<StatusRow>;
  insertLocation(
    values: Pick<LocationRow, "name" | "active">,
  ): Promise<LocationRow>;
  updateLocation(
    id: string,
    values: Partial<Pick<LocationRow, "name" | "active">>,
  ): Promise<LocationRow>;
  audit(row: MasterAudit): Promise<void>;
}

export interface MasterRepository {
  readAccess(roomId: string, userId: string): Promise<MasterRoomAccess | null>;
  readStatuses(roomId: string): Promise<StatusRow[]>;
  readLocations(roomId: string): Promise<LocationRow[]>;
  transaction<T>(run: (tx: MasterTransaction) => Promise<T>): Promise<T>;
}

export type MasterErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "DUPLICATE"
  | "PROTECTED"
  | "LAST_ACTIVE_STATUS";
export class MasterError extends Error {
  constructor(
    public readonly code: MasterErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function roomId(value: string): string {
  const id = normalizeMasterId(value);
  if (!id) throw new MasterError("NOT_FOUND", "Room not found");
  return id;
}

function targetId(value: string): string {
  const id = normalizeMasterId(value);
  if (!id) throw new MasterError("NOT_FOUND", "Master not found");
  return id;
}

function normalize<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof MasterInputError)
      throw new MasterError("INVALID_INPUT", error.message);
    throw error;
  }
}

function checkAccess(
  userId: string,
  access: MasterRoomAccess | null,
  ownerOnly: boolean,
) {
  if (!access || access.status !== "ACTIVE")
    throw new MasterError("NOT_FOUND", "Room not found");
  if (access.ownerUserId === userId) return;
  if (access.memberActive) {
    if (ownerOnly)
      throw new MasterError(
        "FORBIDDEN",
        "Only the room owner can manage masters",
      );
    return;
  }
  throw new MasterError("NOT_FOUND", "Room not found");
}

export async function assertMasterOwner(
  userId: string,
  room: string,
  repo: MasterRepository,
): Promise<string> {
  const id = roomId(room);
  checkAccess(userId, await repo.readAccess(id, userId), true);
  return id;
}

function sortedStatuses(rows: StatusRow[]) {
  return [...rows].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.code.localeCompare(b.code) ||
      a.id.localeCompare(b.id),
  );
}

function sortedLocations(rows: LocationRow[]) {
  return [...rows].sort(
    (a, b) =>
      normalizedName(a.name).localeCompare(normalizedName(b.name)) ||
      a.id.localeCompare(b.id),
  );
}

export async function listStatuses(
  userId: string,
  room: string,
  includeInactive: boolean,
  repo: MasterRepository,
): Promise<StatusRow[]> {
  const id = roomId(room);
  checkAccess(userId, await repo.readAccess(id, userId), includeInactive);
  return sortedStatuses(
    (await repo.readStatuses(id)).filter(
      (row) => row.roomId === id && (includeInactive || row.active),
    ),
  );
}

export async function listLocations(
  userId: string,
  room: string,
  includeInactive: boolean,
  repo: MasterRepository,
): Promise<LocationRow[]> {
  const id = roomId(room);
  checkAccess(userId, await repo.readAccess(id, userId), includeInactive);
  return sortedLocations(
    (await repo.readLocations(id)).filter(
      (row) => row.roomId === id && (includeInactive || row.active),
    ),
  );
}

async function ownerTransaction<T>(
  userId: string,
  room: string,
  repo: MasterRepository,
  run: (tx: MasterTransaction, id: string) => Promise<T>,
): Promise<T> {
  const id = roomId(room);
  return repo.transaction(async (tx) => {
    checkAccess(userId, await tx.lockRoom(id, userId), true);
    return run(tx, id);
  });
}

function statusDuplicate(
  rows: StatusRow[],
  code: string | undefined,
  name: string | undefined,
  except?: string,
) {
  return rows.some(
    (row) =>
      row.id !== except &&
      ((code !== undefined && row.code.toUpperCase() === code) ||
        (name !== undefined &&
          normalizedName(row.name) === normalizedName(name))),
  );
}

function locationDuplicate(rows: LocationRow[], name: string, except?: string) {
  return rows.some(
    (row) =>
      row.id !== except && normalizedName(row.name) === normalizedName(name),
  );
}

function nextOrder(rows: StatusRow[]) {
  return (
    Math.max(
      -1,
      ...rows.filter((row) => row.active).map((row) => row.sortOrder),
    ) + 1
  );
}

function audit(
  userId: string,
  room: string,
  action: MasterAudit["action"],
  entityType: MasterAudit["entityType"],
  entityId: string,
  oldValue: unknown,
  newValue: unknown,
): MasterAudit {
  return {
    userId,
    roomId: room,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
  };
}

export async function createStatus(
  userId: string,
  room: string,
  input: unknown,
  repo: MasterRepository,
) {
  return ownerTransaction(userId, room, repo, async (tx, id) => {
    const values = normalize(() => normalizeStatusCreate(input));
    const rows = await tx.statuses();
    if (statusDuplicate(rows, values.code, values.name))
      throw new MasterError(
        "DUPLICATE",
        "Status code or name is already used in this room; reactivate or rename the existing status",
      );
    const created = await tx.insertStatus({
      ...values,
      active: true,
      sortOrder: nextOrder(rows),
    });
    await tx.audit(
      audit(userId, id, "CREATE_STATUS", "STATUS", created.id, null, created),
    );
    return created;
  });
}

export async function patchStatus(
  userId: string,
  room: string,
  status: string,
  input: unknown,
  repo: MasterRepository,
) {
  return ownerTransaction(userId, room, repo, async (tx, id) => {
    const masterId = targetId(status);
    const before = await tx.status(masterId);
    if (!before || before.roomId !== id)
      throw new MasterError("NOT_FOUND", "Master not found");
    const patch = normalize(() => normalizeStatusPatch(input));
    const rows = await tx.statuses();
    if (
      patch.name !== undefined &&
      statusDuplicate(rows, undefined, patch.name, masterId)
    )
      throw new MasterError(
        "DUPLICATE",
        "Status name is already used in this room; reactivate or rename the existing status",
      );
    if (
      before.active &&
      patch.active === false &&
      rows.filter((row) => row.active).length <= 1
    )
      throw new MasterError(
        "LAST_ACTIVE_STATUS",
        "At least one active status is required",
      );
    const values = {
      ...patch,
      ...(!before.active && patch.active === true
        ? { sortOrder: nextOrder(rows) }
        : {}),
    };
    if (
      Object.entries(values).every(
        ([key, value]) => before[key as keyof StatusRow] === value,
      )
    )
      return before;
    const updated = await tx.updateStatus(masterId, values);
    const action =
      before.active !== updated.active
        ? updated.active
          ? "REACTIVATE_STATUS"
          : "DEACTIVATE_STATUS"
        : "UPDATE_STATUS";
    await tx.audit(
      audit(userId, id, action, "STATUS", masterId, before, updated),
    );
    return updated;
  });
}

export async function deleteStatus(
  userId: string,
  room: string,
  status: string,
  repo: MasterRepository,
) {
  return ownerTransaction(userId, room, repo, async (tx, id) => {
    const masterId = targetId(status);
    const before = await tx.status(masterId);
    if (!before || before.roomId !== id)
      throw new MasterError("NOT_FOUND", "Master not found");
    if (DEFAULT_STATUS_CODES.some((code) => code === before.code))
      throw new MasterError(
        "PROTECTED",
        "Built-in statuses cannot be deleted; use Deactivate",
      );
    if (!before.active) return before;
    const rows = await tx.statuses();
    if (rows.filter((row) => row.active).length <= 1)
      throw new MasterError(
        "LAST_ACTIVE_STATUS",
        "At least one active status is required",
      );
    const updated = await tx.updateStatus(masterId, { active: false });
    await tx.audit(
      audit(
        userId,
        id,
        "DEACTIVATE_STATUS",
        "STATUS",
        masterId,
        before,
        updated,
      ),
    );
    return updated;
  });
}

export async function putStatusOrder(
  userId: string,
  room: string,
  input: unknown,
  repo: MasterRepository,
) {
  return ownerTransaction(userId, room, repo, async (tx, id) => {
    const ids = normalize(() => normalizeStatusOrder(input));
    const current = sortedStatuses(
      (await tx.statuses()).filter((row) => row.active),
    );
    if (
      ids.length !== current.length ||
      ids.some((value) => !current.some((row) => row.id === value))
    )
      throw new MasterError(
        "INVALID_INPUT",
        "Provide every active status ID exactly once",
      );
    if (ids.every((value, index) => current[index].id === value))
      return current;
    const oldValue = current.map(({ id, sortOrder }) => ({ id, sortOrder }));
    const byId = new Map(current.map((row) => [row.id, row]));
    const result: StatusRow[] = [];
    for (const [index, masterId] of ids.entries()) {
      const row = byId.get(masterId)!;
      result.push(
        row.sortOrder === index
          ? row
          : await tx.updateStatus(masterId, { sortOrder: index }),
      );
    }
    await tx.audit(
      audit(
        userId,
        id,
        "REORDER_STATUSES",
        "STATUS_ORDER",
        id,
        oldValue,
        result.map(({ id, sortOrder }) => ({ id, sortOrder })),
      ),
    );
    return result;
  });
}

export async function createLocation(
  userId: string,
  room: string,
  input: unknown,
  repo: MasterRepository,
) {
  return ownerTransaction(userId, room, repo, async (tx, id) => {
    const values = normalize(() => normalizeLocationCreate(input));
    if (locationDuplicate(await tx.locations(), values.name))
      throw new MasterError(
        "DUPLICATE",
        "Location name is already used in this room; reactivate or rename the existing location",
      );
    const created = await tx.insertLocation({ ...values, active: true });
    await tx.audit(
      audit(
        userId,
        id,
        "CREATE_LOCATION",
        "LOCATION",
        created.id,
        null,
        created,
      ),
    );
    return created;
  });
}

export async function patchLocation(
  userId: string,
  room: string,
  location: string,
  input: unknown,
  repo: MasterRepository,
) {
  return ownerTransaction(userId, room, repo, async (tx, id) => {
    const masterId = targetId(location);
    const before = await tx.location(masterId);
    if (!before || before.roomId !== id)
      throw new MasterError("NOT_FOUND", "Master not found");
    const patch = normalize(() => normalizeLocationPatch(input));
    if (
      patch.name !== undefined &&
      locationDuplicate(await tx.locations(), patch.name, masterId)
    )
      throw new MasterError(
        "DUPLICATE",
        "Location name is already used in this room; reactivate or rename the existing location",
      );
    if (
      Object.entries(patch).every(
        ([key, value]) => before[key as keyof LocationRow] === value,
      )
    )
      return before;
    const updated = await tx.updateLocation(masterId, patch);
    const action =
      before.active !== updated.active
        ? updated.active
          ? "REACTIVATE_LOCATION"
          : "DEACTIVATE_LOCATION"
        : "UPDATE_LOCATION";
    await tx.audit(
      audit(userId, id, action, "LOCATION", masterId, before, updated),
    );
    return updated;
  });
}

export async function deleteLocation(
  userId: string,
  room: string,
  location: string,
  repo: MasterRepository,
) {
  return ownerTransaction(userId, room, repo, async (tx, id) => {
    const masterId = targetId(location);
    const before = await tx.location(masterId);
    if (!before || before.roomId !== id)
      throw new MasterError("NOT_FOUND", "Master not found");
    if (!before.active) return before;
    const updated = await tx.updateLocation(masterId, { active: false });
    await tx.audit(
      audit(
        userId,
        id,
        "DEACTIVATE_LOCATION",
        "LOCATION",
        masterId,
        before,
        updated,
      ),
    );
    return updated;
  });
}
