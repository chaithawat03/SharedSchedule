# SharedSchedule

Mobile-first shared scheduling, built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, and Drizzle ORM. This repository currently contains **Milestone 3: Rooms and invites**. The shared calendar arrives in Milestone 4.

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

`/rooms` lists active rooms owned by or joined by the current user without duplicates. `/room/[roomId]` shows the participant list, an explicit owner participation action when needed, and an invite control for the owner; its calendar panel is reserved for Milestone 4. The invite control provides a readonly URL field and a **Copy invite URL** button. It uses the Clipboard API where available, then attempts browser copy from the selected field; if automatic copy is unavailable, the URL remains selected for manual copying on mobile Safari. `/invite/[token]` shows the invited room, reuses the phone identity form when signed out, then joins and opens that room automatically after login or registration.

| Method | Route                        | Access                      | Purpose                                       |
| ------ | ---------------------------- | --------------------------- | --------------------------------------------- |
| `GET`  | `/api/rooms`                 | Session                     | List owned and joined rooms                   |
| `POST` | `/api/rooms`                 | Session                     | Create a named room with zero participants    |
| `GET`  | `/api/rooms/:roomId`         | Owner or active participant | Read room and participants                    |
| `POST` | `/api/rooms/:roomId/join`    | Owner                       | Join as a calendar participant, idempotently  |
| `POST` | `/api/rooms/:roomId/invites` | Owner                       | Create a share link                           |
| `GET`  | `/api/invites/:token`        | Public link holder          | Inspect invite state and room name when valid |
| `POST` | `/api/invites/:token/join`   | Session                     | Join as `MEMBER` and receive the room URL     |

The invite creator may send `expiresAt` as a future ISO date and `maxUses` as a positive integer. The defaults are seven days and no usage limit. Invite URLs use random 32-byte tokens; the database stores only a SHA-256 hash. The raw token is returned in the creation response and is not retrievable later. Invalid or inactive-room invites are rejected, and expired or exhausted invites cannot add new participants. A repeat join by an existing active participant returns the room without using another invite slot, even if the link later expires or reaches its limit. The join transaction locks the invite row before checking and incrementing usage, so concurrent joins cannot exceed its limit. The owner participation route checks `rooms.owner_user_id` inside a transaction and does not use an invite. Room creation, invite creation, and new joins write audit records in the same transaction.

To run PostgreSQL integration tests, provide `TEST_DATABASE_URL` for a **dedicated** database whose name contains `test`, then run `npm test`. The tests apply migrations and clean up their fixtures. Without `TEST_DATABASE_URL`, they are reported as skipped; unit, service, HTTP, and screen tests still run. No local database is needed for the production build.

Milestone 3 verification on 2026-10-06 after the owner participation and invite copy update: `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run build` passed. `npm test` passed 56 tests; three PostgreSQL integration tests were skipped because `TEST_DATABASE_URL` was not available. The owner participation database case and invite concurrency case are among those skipped tests. Docker and local PostgreSQL tools were unavailable in this environment.

## Security note

**Phone number lookup is not real authentication. Anyone who knows another user's phone number can impersonate them.** Room write routes validate the session and room owner authority on the server. Future event routes must also validate room membership and event ownership on the server.

Do not commit `.env.local`, production credentials, or session or invite tokens. Invite URLs grant room access to anyone who can establish a phone identity and should be shared only with intended participants. The repository only contains a sample development connection string.

## Deployment

Provide PostgreSQL and set `DATABASE_URL` in the server environment. Run `npm ci`, `npm run db:migrate`, and `npm run build`, then start with `npm run start`. Run `db:seed` only for development data, never as part of production deployment. Host the Next.js app on a Node-compatible platform and use HTTPS for the future session cookie.
