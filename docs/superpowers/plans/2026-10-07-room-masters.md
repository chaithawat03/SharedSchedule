# Room Masters Implementation Plan

> **For agentic workers:** Use the approved Milestone 8 requirements in the conversation as the binding specification. Execute tasks in order with tests before product code.

**Goal:** Let room owners manage room-scoped status and location masters without changing the database schema or existing schedule semantics.

**Architecture:** Next.js route handlers call a master-data HTTP layer, service, validation module, and Drizzle repository. Every mutation locks the room row before target master rows and writes audit records in the same transaction. The settings page is owner-only; event editors refresh active choices when stale.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle, PostgreSQL, React, Vitest.

**Spec:** Approved Milestone 8 instructions in this conversation and `SHAREDSCHEDULE_BLUEPRINT.md`.

## Global Constraints

- No schema changes, migrations, physical master deletion, label snapshots, realtime sync, or Milestone 9 work.
- Administrative authority comes only from `rooms.owner_user_id`.
- Personal Work Calendar, Event CRUD ownership, and bulk-add semantics remain unchanged.
- Do not touch the two pre-existing untracked milestone Markdown files.

## Review Focus

- Foreign room/master IDs return 404 without names or conflict details.
- Case-insensitive duplicates are serialized by the room lock.
- Inactive referenced masters still resolve in historical events.
- A stale event editor retains unsaved fields while refreshing choices.
- A failed audit rolls back every master write.

## Tasks

### Task 1: Validation and domain service

**Files:** `lib/master-data/validation.ts`, `lib/master-data/icons.ts`, `services/master-data.service.ts`, `tests/master-data.validation.test.ts`, `tests/master-data.service.test.ts`.

- [ ] Write validation and service tests for normalization, permissions, duplicates, built-ins, last-active protection, reactivation, ordering, no-ops, and audit outcomes.
- [ ] Run those tests and confirm the missing implementation fails.
- [ ] Implement pure validation and transaction-driven service methods.
- [ ] Run those tests and confirm they pass.

### Task 2: PostgreSQL repository and HTTP endpoints

**Files:** `lib/master-data/repository.ts`, `lib/master-data/http.ts`, `app/api/rooms/[roomId]/statuses/**`, `app/api/rooms/[roomId]/locations/**`, `tests/master-data.db.test.ts`, `tests/master-data.http.test.ts`.

- [ ] Write HTTP and dedicated-database integration tests for access, room/master scoping, lock order, uniqueness races, audit rollback, and referenced events.
- [ ] Run tests and confirm missing behavior fails or PostgreSQL tests skip without `TEST_DATABASE_URL`.
- [ ] Implement repository and route handlers with no-store responses.
- [ ] Run focused tests and confirm they pass.

### Task 3: Mobile settings and editor freshness

**Files:** `app/room/[roomId]/settings/page.tsx`, `components/rooms/RoomMastersSettings.tsx`, `components/rooms/RoomDetailView.tsx`, `components/calendar/MonthCalendar.tsx`, `components/events/EventForm.tsx`, `components/events/BulkEventEditor.tsx`, `tests/master-data.ui.test.tsx`, `tests/events-ui.test.tsx`.

- [ ] Write UI tests for owner-only navigation, active/inactive controls, built-in treatment, accessible mobile controls, and stale-choice recovery.
- [ ] Run tests and confirm the missing UI behavior fails.
- [ ] Implement the settings page and forms; refresh room choices on return and stale submit.
- [ ] Run focused UI tests and confirm they pass.

### Task 4: Documentation and release verification

**Files:** `README.md` plus changes from Tasks 1–3.

- [ ] Document the endpoints, room authority, deactivation, and current-name historical labels.
- [ ] Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`; fix all failures.
- [ ] Review the diff for schema, migration, work-calendar, and bulk semantics drift.
- [ ] Commit as `feat: add room master settings`, push to `origin/codex/milestone-8-room-masters`, and report SHA and `git status -sb`.
