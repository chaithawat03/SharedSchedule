# SharedSchedule

Mobile-first shared scheduling, built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, and Drizzle ORM. This repository contains **Milestone 7: Working Calendar**.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL 14 or newer, or Docker with Compose

## Local setup

```powershell
npm install
$password = [guid]::NewGuid().ToString("N")
(Get-Content -Raw .env.example).Replace("REPLACE_WITH_LOCAL_PASSWORD", $password) | Set-Content .env.local
docker compose --env-file .env.local up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. If Docker is unavailable, start a PostgreSQL database yourself and set `DATABASE_URL` in `.env.local`. The commands above generate a private local password shared by Compose and the connection string. The Drizzle commands load `.env.local` through their configuration and seed script.

Enter a Thai mobile number to sign in. If the number is new, the app asks for a display name. The sample seed provides Smart (`0812345678`) and Partner (`0899999999`) for local development. Signed-in users arrive at `/rooms`, where they can create and open rooms.

## Scripts

| Script                 | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start the development server                    |
| `npm run build`        | Create a production build                       |
| `npm run lint`         | Run ESLint                                      |
| `npm run typecheck`    | Check strict TypeScript types                   |
| `npm test`             | Run Vitest                                      |
| `npm run format`       | Format project files                            |
| `npm run format:check` | Check formatting                                |
| `npm run db:generate`  | Generate SQL migrations from the Drizzle schema |
| `npm run db:migrate`   | Apply committed migrations to `DATABASE_URL`    |
| `npm run db:seed`      | Insert idempotent development fixtures          |

## Architecture

Future product behavior follows `UI → Route Handler / Server Action → Service → Validation / Permission → Drizzle ORM → PostgreSQL`. Milestone 1 defines the database boundary in `lib/db/`; it does not implement product routes or services early. Calendar dates use PostgreSQL `date`, and local work times use `time without time zone`. Application date and time assumptions use `Asia/Bangkok`.

The schema includes users, sessions, rooms, room members, invites, statuses, locations, work patterns, work overrides, events, notifications, and audit records. Events allow multiple rows per day, date spans, all-day or timed entries, open end times, and soft deletion. `rooms.owner_user_id` is the only source of room administrative authority; `room_members` represents calendar participation, and its `role` does not grant ownership. **A newly created room has zero calendar participants and zero events.** Its owner may explicitly choose **Join as Participant** on the room page; this inserts one `MEMBER` row without changing administrative authority or consuming an invite. Repeating the action leaves that membership unchanged. Room creation never pre-populates work schedules or events.

The development seed is a separate explicit fixture operation. It adds Smart and Partner as participants of the sample room so the later calendar milestones have realistic data. It does not define room-creation behavior. The seed can be re-run without duplicating its records.

## Phone identity sessions

The server normalizes Thai mobile numbers such as `081-234-5678`, `+66 81 234 5678`, and `66812345678` to `+66812345678`; `phone_display` stays separate for the interface. `POST /api/session/login` returns `requiresRegistration` for a new number without a display name. Repeating the request with a display name creates the user and a session. Existing numbers create a session immediately. `GET /api/session/me` returns the current user for a valid session, and `POST /api/session/logout` revokes it.

The server generates a random 32-byte token and stores only its SHA-256 hash in PostgreSQL. The browser receives the raw token only in an HttpOnly, SameSite=Lax cookie with `Path=/`, a 30-day lifetime, and `Secure` in production. Session checks reject expired or revoked records and update `last_active_at` at most once per hour. The landing page resolves the cookie on the server and sends signed-in users to their room list.

## Rooms and invites

`/rooms` lists active rooms owned by or joined by the current user without duplicates. `/room/[roomId]` shows the monthly calendar, participant list, an explicit owner participation action when needed, and an invite control for the owner. The invite control provides a readonly URL field and a **Copy invite URL** button. It uses the Clipboard API where available, then attempts browser copy from the selected field; if automatic copy is unavailable, the URL remains selected for manual copying on mobile Safari. `/invite/[token]` shows the invited room, reuses the phone identity form when signed out, then joins and opens that room automatically after login or registration.

| Method | Route                                           | Access                      | Purpose                                       |
| ------ | ----------------------------------------------- | --------------------------- | --------------------------------------------- |
| `GET`  | `/api/rooms`                                    | Session                     | List owned and joined rooms                   |
| `POST` | `/api/rooms`                                    | Session                     | Create a named room with zero participants    |
| `GET`  | `/api/rooms/:roomId`                            | Owner or active participant | Read room and participants                    |
| `POST` | `/api/rooms/:roomId/join`                       | Owner                       | Join as a calendar participant, idempotently  |
| `POST` | `/api/rooms/:roomId/invites`                    | Owner                       | Create a share link                           |
| `GET`  | `/api/invites/:token`                           | Public link holder          | Inspect invite state and room name when valid |
| `POST` | `/api/invites/:token/join`                      | Session                     | Join as `MEMBER` and receive the room URL     |
| `GET`  | `/api/rooms/:roomId/calendar?year=YYYY&month=M` | Owner or active participant | Read one complete calendar month              |

The invite creator may send `expiresAt` as a future ISO date and `maxUses` as a positive integer. The defaults are seven days and no usage limit. Invite URLs use random 32-byte tokens; the database stores only a SHA-256 hash. The raw token is returned in the creation response and is not retrievable later. Invalid or inactive-room invites are rejected, and expired or exhausted invites cannot add new participants. A repeat join by an existing active participant returns the room without using another invite slot, even if the link later expires or reaches its limit. The join transaction locks the invite row before checking and incrementing usage, so concurrent joins cannot exceed its limit. The owner participation route checks `rooms.owner_user_id` inside a transaction and does not use an invite. Room creation, invite creation, and new joins write audit records in the same transaction.

## Monthly calendar

The room page renders the current Asia/Bangkok month on the server. Previous and next controls request one complete month from the calendar endpoint. The response contains room and current-user details, active members, room-scoped statuses and locations, month bounds, Bangkok `today`, and a `days` object keyed by `YYYY-MM-DD`. Each member/day has a nullable `baseSchedule` and an array of events. An empty room still shows the date grid. A room owner without active membership can read the calendar but has no lane.

Work patterns and overrides are user-global and apply in every room where the user is an active participant. A date override wins over the weekday pattern; absence of both gives a null base schedule. Events are additional entries, including WORK plus OT on one date. A multi-day event remains one database row and appears on each intersecting day in the read model. Timed multi-day entries show their original continuous date/time span in the day sheet. Calendar dates and wall-clock times are returned as strings, without converting them through client timezones.

The server uses a fixed set of room, participant, master-data, pattern, override, and overlapping-event queries. The event query restricts room, active participant IDs, date overlap, and nondeleted rows. Only metadata from the requested room enters the response; malformed foreign-room references receive safe display fallbacks.

## Event CRUD

Active calendar participants can add events from a selected day and edit or delete their own event cards. Room owners who have not joined as participants cannot create events. Weekly patterns and date overrides remain separate and cannot be changed from the event form. New rooms receive the nine default room statuses (WORK, OT, OFF, LEAVE, WFH, TRAVEL, PERSONAL, ACTIVITY, OTHER) in the same transaction as room creation while retaining zero participants and zero events. The `0001_default_room_statuses` data migration adds only missing status codes to existing rooms; it preserves customized status rows.

| Method   | Route                            | Result                                        |
| -------- | -------------------------------- | --------------------------------------------- |
| `POST`   | `/api/rooms/:roomId/events`      | `201` with `{ event }`                        |
| `POST`   | `/api/rooms/:roomId/events/bulk` | `201` with `{ events }`                       |
| `PATCH`  | `/api/events/:eventId`           | `200` with `{ event }`                        |
| `DELETE` | `/api/events/:eventId`           | `200` with `{ event }`, including `deletedAt` |

All three routes use the session cookie, require active room membership, and return no-store responses. Creation assigns owner and creator from the session. Update and delete require event ownership; other active participants receive `403`, while unrelated users receive `404`. Statuses and selected master locations must belong to the event's room and be active when newly chosen. An unchanged historical inactive reference may remain on edit. A master location and custom text cannot be selected together.

Dates are strict `YYYY-MM-DD` strings with inclusive spans. Timed events require strict local `HH:mm` start and end times; a same-day end must be later than its start. An overnight event uses two dates. All-day events clear both times and the end-time-plus flag. Delete sets `deleted_at` without removing the row. Create, changed update, and delete write audit snapshots in the same database transaction. A normalized no-op PATCH writes no audit row. After a successful mutation, the client refetches the displayed calendar month and keeps the selected day in view. If that refetch fails, the form shows a retry control without repeating the event write.

Bulk Edit is **Add to selected dates**: an active participant selects 1–31 distinct days in one displayed month, then submits `{ "dates": ["2026-10-04", "2026-10-08"], "event": { "statusId": "...", "allDay": true, "title": null, "startTime": null, "endTime": null, "endTimeOpen": false, "locationId": null, "locationText": null, "note": null } }`. The server creates one separate single-day event per date and assigns room, owner, creator, and both dates itself. Template system, ownership, and date fields are rejected. Timed bulk events require an end time later than the start time on each date; use the individual editor for overnight or multi-day events. OFF events are additive and leave any base WORK schedule visible. Bulk Edit never writes work patterns or overrides.

The bulk endpoint requires an active room and active membership, including for the room owner. It sorts dates before writing or responding. An active, nondeleted event for the same room, owner, date, and every normalized event-domain field is an exact duplicate; any exact match returns `409` with `code: "DUPLICATE_EVENT"` and sorted `conflictDates`, and creates no events or audit rows. Different event details on the same date remain valid. One PostgreSQL transaction locks the room row `FOR UPDATE`, checks membership and room-scoped active references, checks duplicates, inserts all events, and inserts one `CREATE_EVENT` audit row for each. The room lock serializes **bulk submissions for the same room** through duplicate detection; it does not extend this guarantee to simultaneous individual event creation. No event-equality unique constraint is added. After a successful bulk POST, the UI refetches the currently displayed month; if the GET fails, Retry calendar refresh repeats only the GET.

## Personal work calendar

`/work-calendar` is available to any signed-in user, including someone with no rooms. The room calendar also opens the editor without leaving the displayed month. Work patterns and date overrides are user-global: the same resolved base schedule appears in every room where the user is an active participant. A nonparticipant owner has no lane. Room events remain separate and additive, including OFF events created through Bulk Edit.

| Method   | Route                                      | Result                                                         |
| -------- | ------------------------------------------ | -------------------------------------------------------------- |
| `GET`    | `/api/me/work-pattern`                     | Seven ordered weekdays, with `NONE` for absent rows            |
| `PUT`    | `/api/me/work-pattern`                     | Atomic seven-day diff of `NONE`, `WORK`, and `OFF`             |
| `GET`    | `/api/me/work-overrides?year=YYYY&month=M` | Signed-in user's date-ordered monthly exceptions               |
| `POST`   | `/api/me/work-overrides`                   | Create one WORK or OFF exception; duplicate date returns `409` |
| `PATCH`  | `/api/me/work-overrides/:id`               | Change type, times, or note; date stays fixed                  |
| `DELETE` | `/api/me/work-overrides/:id`               | Physically remove the exception and reveal the weekly pattern  |

`PUT` accepts `{ "days": [{ "weekday": 1, "state": "WORK", "startTime": "07:40", "endTime": "17:00" }, ...] }` with each weekday 1–7 exactly once. `NONE` deletes that weekday row; `OFF` stores a row with null times. A normalized no-op preserves row IDs and timestamps. The transaction locks the user's row, writes only changed weekdays, and audits each actual change. Override PATCH and DELETE lock the owned override row. Create relies on the `(user_id, date)` unique constraint as final duplicate protection. Work times remain local `HH:mm`; WORK requires an end later than its start and does not support overnight base shifts. All work-schedule audits use `room_id = null` and share the mutation transaction.

A factory working Saturday is a single WORK date override. It changes only that date's base schedule; neighboring Saturdays retain their weekly state. The editor offers times only from the selected date's own WORK weekday pattern. After an edit opened from a room calendar, the client refetches that displayed room/month. If the GET fails, retry repeats only the GET.

To run PostgreSQL integration tests, provide `TEST_DATABASE_URL` for a **dedicated** database whose name contains `test`, then run `npm test`. The tests apply migrations and clean up their fixtures. Without `TEST_DATABASE_URL`, they are reported as skipped; unit, service, HTTP, and screen tests still run. No local database is needed for the production build.

Milestone 3 verification on 2026-10-06 after the owner participation and invite copy update: `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run build` passed. `npm test` passed 56 tests; three PostgreSQL integration tests were skipped because `TEST_DATABASE_URL` was not available. The owner participation database case and invite concurrency case are among those skipped tests. Docker and local PostgreSQL tools were unavailable in this environment.

## Security note

**Phone number lookup is not real authentication. Anyone who knows another user's phone number can impersonate them.** Room and event write routes validate session, membership, and relevant ownership on the server.

Do not commit `.env.local`, production credentials, or session or invite tokens. Invite URLs grant room access to anyone who can establish a phone identity and should be shared only with intended participants. The repository only contains a sample development connection string.

## Deployment

Provide PostgreSQL and set `DATABASE_URL` in the server environment. Run `npm ci`, `npm run db:migrate`, and `npm run build`, then start with `npm run start`. Run `db:seed` only for development data, never as part of production deployment. Host the Next.js app on a Node-compatible platform and use HTTPS for the future session cookie.
