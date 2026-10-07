import { and, eq, gte, lte } from "drizzle-orm";
import { createDatabase, getDatabase } from "../db";
import { auditLog, users, workOverrides, workPatterns } from "../db/schema";
import {
  WorkScheduleError,
  type WorkScheduleRepository,
  type WorkScheduleTransaction,
} from "../../services/work-schedule.service";

type Database = ReturnType<typeof createDatabase>["db"];

function duplicateDate(error: unknown): boolean {
  let cause = error;
  for (
    let depth = 0;
    depth < 4 && cause && typeof cause === "object";
    depth++
  ) {
    const value = cause as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (
      value.code === "23505" &&
      value.constraint === "work_overrides_user_date_unique"
    )
      return true;
    cause = value.cause;
  }
  return false;
}

export function createWorkScheduleRepository(
  db: Database,
): WorkScheduleRepository {
  return {
    patterns(userId) {
      return db
        .select()
        .from(workPatterns)
        .where(eq(workPatterns.userId, userId));
    },
    overrides(userId, start, end) {
      return db
        .select()
        .from(workOverrides)
        .where(
          and(
            eq(workOverrides.userId, userId),
            gte(workOverrides.date, start),
            lte(workOverrides.date, end),
          ),
        )
        .orderBy(workOverrides.date);
    },
    transaction(runUserId, run) {
      return db.transaction(async (tx) => {
        const [owner] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, runUserId))
          .limit(1)
          .for("update");
        if (!owner) throw new WorkScheduleError("NOT_FOUND", "User not found");
        const store: WorkScheduleTransaction = {
          patternRows() {
            return tx
              .select()
              .from(workPatterns)
              .where(eq(workPatterns.userId, runUserId))
              .orderBy(workPatterns.weekday);
          },
          async override(id) {
            const [row] = await tx
              .select()
              .from(workOverrides)
              .where(
                and(
                  eq(workOverrides.id, id),
                  eq(workOverrides.userId, runUserId),
                ),
              )
              .limit(1)
              .for("update");
            return row ?? null;
          },
          async overrideForDate(date) {
            const [row] = await tx
              .select()
              .from(workOverrides)
              .where(
                and(
                  eq(workOverrides.userId, runUserId),
                  eq(workOverrides.date, date),
                ),
              )
              .limit(1);
            return row ?? null;
          },
          async insertPattern(values) {
            const [row] = await tx
              .insert(workPatterns)
              .values({ ...values, userId: runUserId })
              .returning();
            return row;
          },
          async updatePattern(row, values, at) {
            const [updated] = await tx
              .update(workPatterns)
              .set({ ...values, updatedAt: at })
              .where(
                and(
                  eq(workPatterns.id, row.id),
                  eq(workPatterns.userId, runUserId),
                ),
              )
              .returning();
            if (!updated) throw new Error("Pattern changed during update");
            return updated;
          },
          async deletePattern(row) {
            await tx
              .delete(workPatterns)
              .where(
                and(
                  eq(workPatterns.id, row.id),
                  eq(workPatterns.userId, runUserId),
                ),
              );
          },
          async insertOverride(values) {
            try {
              const [row] = await tx
                .insert(workOverrides)
                .values({ ...values, userId: runUserId })
                .returning();
              return row;
            } catch (error) {
              if (duplicateDate(error))
                throw new WorkScheduleError(
                  "DUPLICATE",
                  "An exception already exists for this date",
                );
              throw error;
            }
          },
          async updateOverride(row, values, at) {
            const [updated] = await tx
              .update(workOverrides)
              .set({ ...values, updatedAt: at })
              .where(
                and(
                  eq(workOverrides.id, row.id),
                  eq(workOverrides.userId, runUserId),
                ),
              )
              .returning();
            if (!updated) throw new Error("Exception changed during update");
            return updated;
          },
          async deleteOverride(row) {
            await tx
              .delete(workOverrides)
              .where(
                and(
                  eq(workOverrides.id, row.id),
                  eq(workOverrides.userId, runUserId),
                ),
              );
          },
          async audit(action, entityId, oldValue, newValue) {
            await tx.insert(auditLog).values({
              userId: runUserId,
              roomId: null,
              action,
              entityType: action.endsWith("WORK_PATTERN")
                ? "WORK_PATTERN"
                : "WORK_OVERRIDE",
              entityId,
              oldValue,
              newValue,
            });
          },
        };
        return run(store);
      });
    },
  };
}

export function getWorkScheduleRepository() {
  return createWorkScheduleRepository(getDatabase().db);
}
