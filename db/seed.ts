import { existsSync } from "node:fs";
import { createDatabase } from "../lib/db";
import {
  events,
  locationMaster,
  roomMembers,
  rooms,
  statusMaster,
  users,
  workOverrides,
  workPatterns,
} from "../lib/db/schema";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const ids = {
  smart: "10000000-0000-4000-8000-000000000001",
  partner: "10000000-0000-4000-8000-000000000002",
  room: "20000000-0000-4000-8000-000000000001",
  smartMembership: "21000000-0000-4000-8000-000000000001",
  partnerMembership: "21000000-0000-4000-8000-000000000002",
  mcp: "40000000-0000-4000-8000-000000000001",
  saturdayOverride: "50000000-0000-4000-8000-000000000001",
  otEvent: "60000000-0000-4000-8000-000000000001",
  offEvent: "60000000-0000-4000-8000-000000000002",
  activityEvent: "60000000-0000-4000-8000-000000000003",
} as const;

const statusCodes = [
  "WORK",
  "OT",
  "OFF",
  "LEAVE",
  "WFH",
  "TRAVEL",
  "PERSONAL",
  "ACTIVITY",
  "OTHER",
] as const;
const statusId = (index: number) =>
  `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

async function main() {
  const { db, pool } = createDatabase();

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(users)
        .values([
          {
            id: ids.smart,
            phoneNormalized: "+66812345678",
            phoneDisplay: "0812345678",
            displayName: "Smart",
            avatarText: "S",
            defaultColor: "#5b9877",
          },
          {
            id: ids.partner,
            phoneNormalized: "+66899999999",
            phoneDisplay: "0899999999",
            displayName: "Partner",
            avatarText: "P",
            defaultColor: "#d9a566",
          },
        ])
        .onConflictDoNothing();

      // Room ownership alone does not insert anyone into room_members.
      await tx
        .insert(rooms)
        .values({
          id: ids.room,
          name: "Smart & Partner",
          ownerUserId: ids.smart,
        })
        .onConflictDoNothing();

      // These fixture participants are an explicit, separate seed step.
      await tx
        .insert(roomMembers)
        .values([
          {
            id: ids.smartMembership,
            roomId: ids.room,
            userId: ids.smart,
            role: "OWNER",
          },
          {
            id: ids.partnerMembership,
            roomId: ids.room,
            userId: ids.partner,
            role: "MEMBER",
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(statusMaster)
        .values(
          statusCodes.map((code, index) => ({
            id: statusId(index),
            roomId: ids.room,
            code,
            name: code,
            sortOrder: index,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(locationMaster)
        .values({ id: ids.mcp, roomId: ids.room, name: "MCP" })
        .onConflictDoNothing();

      await tx
        .insert(workPatterns)
        .values(
          Array.from({ length: 7 }, (_, index) => ({
            id: `41000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
            userId: ids.smart,
            weekday: index + 1,
            working: index < 5,
            startTime: index < 5 ? "07:40" : null,
            endTime: index < 5 ? "17:00" : null,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(workOverrides)
        .values({
          id: ids.saturdayOverride,
          userId: ids.smart,
          date: "2026-10-10",
          type: "WORK",
          startTime: "07:40",
          endTime: "17:00",
          note: "Factory working Saturday",
        })
        .onConflictDoNothing();

      await tx
        .insert(events)
        .values([
          {
            id: ids.otEvent,
            roomId: ids.room,
            ownerUserId: ids.smart,
            createdBy: ids.smart,
            statusId: statusId(1),
            startDate: "2026-10-12",
            endDate: "2026-10-12",
            startTime: "17:20",
            endTime: "19:40",
            endTimeOpen: true,
            locationId: ids.mcp,
          },
          {
            id: ids.offEvent,
            roomId: ids.room,
            ownerUserId: ids.partner,
            createdBy: ids.partner,
            statusId: statusId(2),
            startDate: "2026-10-08",
            endDate: "2026-10-08",
            allDay: true,
          },
          {
            id: ids.activityEvent,
            roomId: ids.room,
            ownerUserId: ids.smart,
            createdBy: ids.smart,
            statusId: statusId(7),
            title: "Phu Soi Dao",
            startDate: "2026-12-27",
            endDate: "2026-12-29",
            allDay: true,
            locationText: "Phu Soi Dao",
          },
        ])
        .onConflictDoNothing();
    });

    console.info(
      "Development data seeded for Asia/Bangkok calendar dates and local times.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
