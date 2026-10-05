# SharedSchedule

Mobile-first shared scheduling, built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, and Drizzle ORM. This repository currently contains **Milestone 1: Foundation**. The landing page is a responsive shell; login, room actions, invites, and the calendar arrive in later milestones.

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

The schema includes users, sessions, rooms, room members, invites, statuses, locations, work patterns, work overrides, events, notifications, and audit records. Events allow multiple rows per day, date spans, all-day or timed entries, open end times, and soft deletion. `rooms.owner_user_id` grants administrative ownership independently of `room_members`. **A newly created room has zero calendar participants.** Its owner must explicitly join or be added before appearing in that room's calendar. Room creation must never pre-populate work schedules or events.

The development seed is a separate explicit fixture operation. It adds Smart and Partner as participants of the sample room so the later calendar milestones have realistic data. It does not define room-creation behavior. The seed can be re-run without duplicating its records.

## Security note

**Phone number lookup is not real authentication. Anyone who knows another user's phone number can impersonate them.** Phone identity sessions are planned for Milestone 2. Future write routes must validate the session, room membership or room owner authority, and event ownership on the server.

Do not commit `.env.local`, production credentials, or session or invite tokens. The repository only contains a sample development connection string.

## Deployment

Provide PostgreSQL and set `DATABASE_URL` in the server environment. Run `npm ci`, `npm run db:migrate`, and `npm run build`, then start with `npm run start`. Run `db:seed` only for development data, never as part of production deployment. Host the Next.js app on a Node-compatible platform and use HTTPS for the future session cookie.
