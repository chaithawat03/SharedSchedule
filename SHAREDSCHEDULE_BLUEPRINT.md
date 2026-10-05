# SharedSchedule — Product & Technical Blueprint for Codex

## 0. Objective

Build a fast, mobile-first shared schedule web app named **SharedSchedule**.

The application is primarily for two people at first, but the architecture must support multiple users and multiple rooms in the future.

The app must NOT use Google Apps Script as the main application runtime.

Primary goals:

- Fast response on mobile browser, especially **iPhone Safari**
- Shared monthly calendar
- Each member can see everyone in the same room
- Each member can edit **only their own schedule**
- Support irregular work schedules, OT, days off, leave, travel, personal activities, and custom statuses
- Support multiple events in the same day
- Support different work locations / branches
- Support room creation and invite URL
- Login is intentionally simple: **phone-number database lookup only**
- No OTP / Firebase Auth / Google Auth for MVP
- Architecture should be clean enough for Codex to continue maintaining it

---

# 1. Recommended Technology Stack

Use this stack unless there is a strong implementation reason to substitute an equivalent:

## Frontend + Backend

- **Next.js**
- **TypeScript**
- App Router
- Server Actions and/or REST route handlers
- React
- Tailwind CSS
- Mobile-first responsive design

## Database

Use **PostgreSQL**.

Preferred hosted choices:

- Supabase Postgres
- Neon Postgres
- Standard PostgreSQL

Use an ORM such as:

- Drizzle ORM, preferred
- Prisma is acceptable if implementation is significantly easier

## Session

Do NOT implement real phone authentication in MVP.

Flow:

1. User enters mobile number.
2. Server normalizes phone number.
3. Server checks whether the number exists in `users`.
4. If found, create a session.
5. If not found, request display name and create user.
6. Store a random session token on the server.
7. Send the session token using a secure HTTP-only cookie.

Important:

This is **identity lookup, not secure authentication**.

Anyone who knows another user's phone number can impersonate them.

The codebase must make that limitation clear in README.

---

# 2. Core Product Concept

The system is based on:

```text
User
  │
  ├── can belong to many Rooms
  │
Room
  │
  ├── contains many Members
  │
  └── contains shared calendar data
```

Typical example:

```text
Room: Smart & Partner

Members:
- Smart
- Partner
```

Possible future use:

```text
Rooms:
- Smart & Partner
- Family
- Hiking Group
```

---

# 3. Main User Requirements

## 3.1 Room

A user can:

- Create a room
- Name the room
- Invite another user through a share URL
- Belong to multiple rooms
- Switch between rooms

Example invite URL:

```text
https://example.com/invite/a9kd73kdk39...
```

If a user opens an invite URL:

```text
Open invite URL
      ↓
Already has valid session?
      │
   YES│       NO
      │        ↓
      │    Phone login
      │        ↓
      └────────┘
           ↓
Validate invite
           ↓
Join room
           ↓
Open that room directly
```

The invited user must NOT be forced to manually select the room after opening the invite link.

---

# 4. Permission Rules

## Owner

Can:

- View schedules of everyone in room
- Edit only their own schedule
- Change room settings
- Create invite URL
- Manage members
- Add/edit custom status master
- Add/edit location master

## Member

Can:

- View schedules of everyone in room
- Create own schedule
- Edit own schedule
- Delete own schedule

Cannot:

- Edit other members' schedules
- Change owner-only room configuration

Permission checks MUST be enforced on the server.

Do not rely only on hiding Edit/Delete buttons in the UI.

Example rule:

```ts
if (event.ownerUserId !== session.userId) {
  throw new ForbiddenError()
}
```

---

# 5. Schedule Requirements

One calendar date can have multiple events.

Example:

```text
12 October 2026

Smart

WORK
07:40 - 17:00
MCP

OT
17:20 - 19:40+
MCP
```

This MUST be represented as two different events.

Do NOT design the database as:

```text
one date = one status
```

because it will not support real usage.

---

# 6. Default Work Schedule

For Smart, default schedule is usually:

```text
Monday-Friday
WORK
07:40-17:00

Saturday-Sunday
OFF
```

However, factory working calendar may contain working Saturdays.

Therefore use two layers:

```text
Default Weekly Pattern
          +
Date Override
```

Example:

```text
Default:
Mon-Fri WORK
Sat-Sun OFF

Override:
2026-10-10 WORK 07:40-17:00
2026-10-24 WORK 07:40-17:00
```

Date override must win over weekly pattern.

---

# 7. Partner Work Schedule

Partner's work schedule can change every month and days off may not follow a fixed weekly pattern.

The app must support:

## Single-date edit

Example:

```text
8 October
DAY OFF
```

## Bulk edit

Example:

User selects:

```text
4, 8, 12, 13, 17, 22, 27
```

Then applies:

```text
Status: DAY OFF
```

once.

Bulk edit should also support:

- Work
- OT
- Location
- Start/end time
- All day
- Note

---

# 8. Statuses

System default statuses:

```text
WORK
OT
OFF
LEAVE
WFH
TRAVEL
PERSONAL
ACTIVITY
OTHER
```

The room owner must be able to add custom statuses later.

Examples:

```text
TRAINING
FIELD_WORK
MEETING
SHIFT_A
SHIFT_B
```

Each status should contain:

```text
id
room_id
code
name
icon
color
sort_order
active
```

Do not hard-code every status in frontend business logic.

---

# 9. Locations

A room has a location master.

Examples:

```text
MCP
Branch A
Branch B
WFH
```

The event editor should allow:

```text
Dropdown from Location Master
```

and also:

```text
Free-text custom location
```

Example:

```text
Phu Soi Dao
Customer ABC
Bangkok Office
```

---

# 10. Multi-day Events

Support activities spanning multiple dates.

Example:

```text
Title: Phu Soi Dao
Status: ACTIVITY
Start: 2026-12-27
End:   2026-12-29
All day: true
Location: ภูสอยดาว
```

Store as one event.

Do NOT create three separate event rows.

The calendar UI should render it on all three days.

---

# 11. Time Handling

Store calendar dates using:

```text
YYYY-MM-DD
```

Example:

```text
2026-10-12
```

Store work times as local wall-clock times:

```text
HH:mm
```

Example:

```text
07:40
17:00
17:20
19:40
```

Do not unnecessarily convert work shift times to UTC timestamps.

Support open-ended OT:

```text
19:40+
```

Recommended fields:

```text
start_time
end_time
end_time_open
```

Example:

```text
start_time = 17:20
end_time = 19:40
end_time_open = true
```

Primary application timezone:

```text
Asia/Bangkok
```

---

# 12. Database Schema

Use PostgreSQL.

## users

```text
id UUID PK
phone_normalized VARCHAR UNIQUE NOT NULL
phone_display VARCHAR
display_name VARCHAR NOT NULL
avatar_text VARCHAR
default_color VARCHAR
status VARCHAR
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Never use phone number as primary key.

---

## sessions

```text
id UUID PK
token_hash VARCHAR UNIQUE NOT NULL
user_id UUID FK users.id
created_at TIMESTAMPTZ
expires_at TIMESTAMPTZ
last_active_at TIMESTAMPTZ
status VARCHAR
```

Session token should be random.

Prefer storing a hash of the session token in DB.

Browser should receive the raw token through HTTP-only cookie.

---

## rooms

```text
id UUID PK
name VARCHAR NOT NULL
owner_user_id UUID FK users.id
description TEXT
status VARCHAR
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

## room_members

```text
id UUID PK
room_id UUID FK rooms.id
user_id UUID FK users.id
role VARCHAR
joined_at TIMESTAMPTZ
status VARCHAR
```

Unique constraint:

```text
(room_id, user_id)
```

Roles:

```text
OWNER
MEMBER
```

---

## room_invites

```text
id UUID PK
room_id UUID FK rooms.id
token_hash VARCHAR UNIQUE NOT NULL
created_by UUID FK users.id
expires_at TIMESTAMPTZ
max_uses INTEGER
used_count INTEGER
status VARCHAR
created_at TIMESTAMPTZ
```

Invite token should be random and difficult to guess.

---

## status_master

```text
id UUID PK
room_id UUID FK rooms.id
code VARCHAR
name VARCHAR
icon VARCHAR
color VARCHAR
sort_order INTEGER
active BOOLEAN
created_at TIMESTAMPTZ
```

Unique recommendation:

```text
(room_id, code)
```

---

## location_master

```text
id UUID PK
room_id UUID FK rooms.id
name VARCHAR
active BOOLEAN
created_at TIMESTAMPTZ
```

---

## work_patterns

```text
id UUID PK
user_id UUID FK users.id
weekday INTEGER
working BOOLEAN
start_time TIME
end_time TIME
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Weekday:

```text
1 = Monday
...
7 = Sunday
```

Unique:

```text
(user_id, weekday)
```

---

## work_overrides

```text
id UUID PK
user_id UUID FK users.id
date DATE
type VARCHAR
start_time TIME NULL
end_time TIME NULL
note TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Types:

```text
WORK
OFF
```

Unique:

```text
(user_id, date)
```

---

## events

```text
id UUID PK
room_id UUID FK rooms.id
owner_user_id UUID FK users.id
status_id UUID FK status_master.id

title VARCHAR

start_date DATE NOT NULL
end_date DATE NOT NULL

start_time TIME NULL
end_time TIME NULL
end_time_open BOOLEAN DEFAULT FALSE
all_day BOOLEAN DEFAULT FALSE

location_id UUID NULL FK location_master.id
location_text VARCHAR NULL

note TEXT

created_by UUID FK users.id
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
deleted_at TIMESTAMPTZ NULL
```

Indexes should include:

```text
(room_id, start_date, end_date)
(owner_user_id, start_date)
(status_id)
```

---

## notifications

Prepare schema now, feature may be implemented later.

```text
id UUID PK
room_id UUID FK rooms.id
from_user_id UUID FK users.id
to_user_id UUID FK users.id
event_id UUID NULL FK events.id
type VARCHAR
message TEXT
read_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

Future channels may include:

```text
In-app
Email
LINE
Push
```

Do not implement SMS for MVP.

---

## audit_log

```text
id UUID PK
user_id UUID
room_id UUID NULL
action VARCHAR
entity_type VARCHAR
entity_id UUID
old_value JSONB
new_value JSONB
created_at TIMESTAMPTZ
```

Examples:

```text
CREATE_EVENT
UPDATE_EVENT
DELETE_EVENT
CREATE_ROOM
JOIN_ROOM
CREATE_INVITE
UPDATE_WORK_PATTERN
UPDATE_WORK_OVERRIDE
```

---

# 13. Calendar Aggregation Logic

The monthly calendar API should return everything needed for one month in one request.

Example:

```http
GET /api/rooms/:roomId/calendar?year=2026&month=10
```

Server should aggregate:

```text
Room
Members
Statuses
Locations
Weekly work patterns
Date overrides
Events intersecting selected month
```

Calendar resolution order for each user/date:

```text
1. Date work override
2. Weekly work pattern
3. User-created events
```

User-created events are additional schedule entries and should not necessarily replace default work pattern.

Example:

```text
Default WORK 07:40-17:00
+
Manual OT 17:20-19:40+
```

Both are displayed.

---

# 14. Suggested API Design

Exact framework implementation may differ, but keep similar boundaries.

## Session

```text
POST /api/session/login
POST /api/session/logout
GET  /api/session/me
```

Login request:

```json
{
  "phone": "0812345678",
  "displayName": "Smart"
}
```

If phone does not exist and displayName is missing:

```json
{
  "requiresRegistration": true
}
```

---

## Rooms

```text
GET  /api/rooms
POST /api/rooms
GET  /api/rooms/:roomId

POST /api/rooms/:roomId/invites
POST /api/invites/:token/join
```

---

## Calendar

```text
GET /api/rooms/:roomId/calendar?year=2026&month=10
```

---

## Events

```text
POST   /api/rooms/:roomId/events
PATCH  /api/events/:eventId
DELETE /api/events/:eventId

POST /api/rooms/:roomId/events/bulk
```

---

## Master Data

```text
GET  /api/rooms/:roomId/statuses
POST /api/rooms/:roomId/statuses

GET  /api/rooms/:roomId/locations
POST /api/rooms/:roomId/locations
```

---

## Work Schedule

```text
GET /api/me/work-pattern
PUT /api/me/work-pattern

GET  /api/me/work-overrides?year=2026&month=10
POST /api/me/work-overrides
PATCH /api/me/work-overrides/:id
DELETE /api/me/work-overrides/:id
```

---

# 15. UI / Screen Flow

## App start

```text
START
  ↓
Invite URL present?
  ↓
Check session
  │
  ├─ valid
  │
  └─ no session → Phone identity screen
  ↓
If invite exists → join/open invite room
Else
  ↓
Room list
  ↓
Calendar
```

---

# 16. Login Screen

Mobile-first.

```text
SharedSchedule

Phone number
[ 0812345678 ]

[ Continue ]
```

If number not found:

```text
This number is not registered.

Display name
[ Smart ]

Phone
0812345678

[ Create account ]
```

No password.

No OTP.

---

# 17. Room List

Example:

```text
My Rooms

┌──────────────────────────┐
│ Smart & Partner          │
│ 2 members                │
└──────────────────────────┘

┌──────────────────────────┐
│ Family                   │
│ 4 members                │
└──────────────────────────┘

[ + Create Room ]
```

---

# 18. Monthly Calendar

This is the main screen.

Mobile layout must remain usable on iPhone Safari.

Calendar cell should show concise information.

Example:

```text
12

Smart
WORK
OT

Partner
OFF
```

Do NOT attempt to display all details in the monthly cell.

Tap day to open day details.

---

# 19. Day Detail

Example:

```text
12 October 2026

SMART
──────────────────
WORK
07:40 - 17:00
MCP

OT
17:20 - 19:40+
MCP

[ Edit ]


PARTNER
──────────────────
DAY OFF


[ + Add my schedule ]
```

Edit button appears only for current user's events.

---

# 20. Add / Edit Event

Fields:

```text
Start date
End date
Status
All day
Start time
End time
End time +
Location dropdown
Location free text
Title
Note
```

Must support:

```text
single day
multi-day
multiple events on same date
all-day events
timed events
```

---

# 21. Bulk Edit Screen

Example:

```text
October 2026

Select:
4, 8, 12, 13, 17, 22, 27

Status
[ DAY OFF ]

[ Apply ]
```

Use cases:

```text
Select all monthly days off
Apply once
```

or:

```text
Select 5, 6, 9, 21
WORK
09:00-18:00
Branch B
```

---

# 22. Work Calendar Screen

Example:

```text
Default Weekly Schedule

Mon  WORK 07:40-17:00
Tue  WORK 07:40-17:00
Wed  WORK 07:40-17:00
Thu  WORK 07:40-17:00
Fri  WORK 07:40-17:00
Sat  OFF
Sun  OFF


October Exceptions

10 Oct
WORK
07:40-17:00
Working Saturday

24 Oct
WORK
07:40-17:00
Factory Calendar
```

---

# 23. Room Settings

Example:

```text
Room: Smart & Partner

Members
- Smart      OWNER
- Partner    MEMBER

[ Share Invite URL ]

Statuses
- WORK
- OT
- OFF
- LEAVE
- WFH
- TRAVEL
- ACTIVITY
[ + Add ]

Locations
- MCP
- Branch A
- WFH
[ + Add ]
```

---

# 24. Mobile / iPhone Safari Requirements

Treat iPhone Safari as a first-class target.

Requirements:

- Mobile-first
- Responsive from ~320 px width upward
- No hover-only interactions
- Minimum touch target around 44 px
- Respect safe areas
- Avoid keyboard covering important actions
- Bottom navigation should respect:

```css
padding-bottom: env(safe-area-inset-bottom);
```

- Use bottom sheets or full-screen mobile dialogs rather than tiny desktop modals
- Calendar must not require pinch zoom
- Avoid horizontal scrolling for the main calendar
- Forms must use appropriate mobile input types:

```html
type="tel"
type="date"
type="time"
```

- Test in:
  - iPhone Safari
  - Android Chrome
  - Desktop Chrome/Edge

---

# 25. Performance Requirements

This project is replacing Google Apps Script partly because latency is a concern.

Therefore:

- Avoid N+1 database queries
- Fetch month calendar in one server request
- Add indexes for room/date lookups
- Server should aggregate month data
- Client should not download the entire database
- Cache relatively static room master data where appropriate
- Use optimistic UI only where safe
- Avoid unnecessary React re-renders
- Lazy load settings screens if useful
- Keep first page lightweight

Target expectation for normal usage:

```text
Room/calendar page should feel immediate on repeat navigation.
Month switching should normally complete in well under a few seconds.
```

Do not artificially delay UI.

---

# 26. Security / Validation

Even though phone login is intentionally weak, implement normal application security.

Required:

- Server-side session validation
- Server-side room membership validation
- Server-side event ownership validation
- Validate all input
- Parameterized SQL through ORM
- Never expose DB credentials client-side
- HTTP-only session cookie
- SameSite=Lax or stricter
- Secure cookie in production
- Random invite tokens
- Random session tokens
- Store session/invite token hashes if practical
- Soft delete events
- Audit writes

Explicit README warning:

> Phone number lookup is not real authentication. Anyone who knows another user's phone number can impersonate them.

---

# 27. Suggested Project Structure

```text
SharedSchedule/
│
├─ app/
│  ├─ page.tsx
│  ├─ login/
│  ├─ rooms/
│  ├─ room/
│  │  └─ [roomId]/
│  │     ├─ page.tsx
│  │     ├─ calendar/
│  │     └─ settings/
│  │
│  ├─ invite/
│  │  └─ [token]/
│  │
│  └─ api/
│     ├─ session/
│     ├─ rooms/
│     ├─ invites/
│     ├─ events/
│     ├─ calendar/
│     ├─ status/
│     ├─ locations/
│     └─ work-schedule/
│
├─ components/
│  ├─ calendar/
│  │  ├─ MonthCalendar.tsx
│  │  ├─ CalendarDay.tsx
│  │  ├─ DayDetailSheet.tsx
│  │  └─ MemberScheduleLane.tsx
│  │
│  ├─ events/
│  │  ├─ EventForm.tsx
│  │  └─ BulkEventEditor.tsx
│  │
│  ├─ rooms/
│  │  ├─ RoomCard.tsx
│  │  ├─ RoomSwitcher.tsx
│  │  └─ InviteDialog.tsx
│  │
│  └─ ui/
│
├─ lib/
│  ├─ db/
│  │  ├─ index.ts
│  │  ├─ schema.ts
│  │  └─ queries/
│  │
│  ├─ session/
│  ├─ permissions/
│  ├─ validation/
│  ├─ calendar/
│  ├─ phone/
│  └─ date/
│
├─ services/
│  ├─ session.service.ts
│  ├─ room.service.ts
│  ├─ event.service.ts
│  ├─ calendar.service.ts
│  ├─ workSchedule.service.ts
│  ├─ masterData.service.ts
│  └─ audit.service.ts
│
├─ types/
│
├─ drizzle/
│
├─ public/
│
├─ tests/
│
├─ .env.example
├─ README.md
├─ package.json
└─ docker-compose.yml
```

Equivalent structure is acceptable if separation of concerns is maintained.

---

# 28. Business Logic Boundaries

Keep architecture approximately:

```text
UI
 ↓
Route / Server Action
 ↓
Service
 ↓
Permission / Validation
 ↓
Repository / ORM
 ↓
PostgreSQL
```

Avoid putting business rules directly inside React components.

Calendar computation should be in:

```text
calendar.service
```

not scattered across UI components.

---

# 29. Calendar Service Rules

For selected month:

1. Load room members
2. Load active status master
3. Load locations
4. Load weekly patterns for room members
5. Load overrides overlapping month
6. Load events overlapping month
7. Create day model
8. Return pre-aggregated JSON to client

Pseudo output:

```json
{
  "room": {},
  "currentUser": {},
  "members": [],
  "statuses": [],
  "locations": [],
  "days": {
    "2026-10-12": {
      "users": {
        "user-1": {
          "baseSchedule": {
            "code": "WORK",
            "startTime": "07:40",
            "endTime": "17:00",
            "source": "PATTERN"
          },
          "events": [
            {
              "code": "OT",
              "startTime": "17:20",
              "endTime": "19:40",
              "endTimeOpen": true
            }
          ]
        }
      }
    }
  }
}
```

---

# 30. Notifications

MVP does NOT need external notification delivery.

But create the domain structure so future implementation can add:

```text
In-app
Email
LINE
Push
```

Potential future event:

```text
Partner changes day off
Smart receives notification
```

Do not tightly couple event creation to a specific external messaging provider.

Use an abstraction such as:

```ts
NotificationService.publish(...)
```

---

# 31. Future Feature: Together Free Day Finder

Not required for initial MVP, but architecture should make it easy.

Example:

```text
October 2026

Both available:
4 Oct
17 Oct
22 Oct
27 Oct
```

Possible logic:

```text
A date is mutually free if all selected members have no WORK event/base schedule and no blocking personal event.
```

Do not implement until MVP works unless there is very little additional effort.

---

# 32. Development Phases

## Milestone 1 — Foundation

Deliver:

- Next.js + TypeScript
- PostgreSQL
- ORM schema
- migrations
- seed data
- environment configuration
- basic responsive shell

Acceptance:

```text
npm install
npm run dev
```

works cleanly.

---

## Milestone 2 — Phone Identity Session

Deliver:

- phone normalization
- lookup existing phone
- create user if missing
- session cookie
- logout
- `/api/session/me`

Acceptance:

```text
081-234-5678
0812345678
+66 81 234 5678
```

resolve to the same normalized value.

---

## Milestone 3 — Rooms

Deliver:

- create room
- room list
- owner/member relationship
- invite generation
- join by invite URL
- direct room open after invite

---

## Milestone 4 — Calendar Read Model

Deliver:

- default work pattern
- monthly calendar endpoint
- member lanes
- day detail view
- responsive mobile calendar

---

## Milestone 5 — Event CRUD

Deliver:

- create own event
- edit own event
- delete own event
- multiple events/day
- multi-day event
- location
- title/note
- all day
- OT time +

Acceptance:

A member cannot update another member's event even by manually calling API.

---

## Milestone 6 — Bulk Edit

Deliver:

- multi-date selection
- status apply
- location apply
- optional time
- all-day apply

---

## Milestone 7 — Work Calendar

Deliver:

- weekly work pattern editor
- working Saturday override
- OFF override
- monthly exception list

---

## Milestone 8 — Room Master Data

Deliver:

- custom status
- custom location
- owner-only management

---

## Milestone 9 — Audit / Notifications Foundation

Deliver:

- audit_log
- notification records
- unread notification UI if straightforward

---

## Milestone 10 — UX Polish / Mobile

Deliver:

- iPhone Safari fixes
- loading states
- empty states
- safe areas
- error handling
- accessibility pass
- responsive desktop layout

---

# 33. Required Tests

At minimum:

## Unit tests

- phone normalization
- work-pattern resolution
- override wins over weekly pattern
- month overlap calculation for multi-day events
- event ownership permission
- invite validation

## Integration tests

- create user
- login existing user
- create room
- invite second user
- join room
- create event
- attempt unauthorized edit
- bulk create
- monthly calendar query

## Critical E2E flow

```text
User A
→ login
→ create room
→ create invite

User B
→ open invite
→ login/register
→ automatically join room

User A
→ add WORK + OT

User B
→ sees User A schedule
→ cannot edit User A event
→ adds own OFF day

User A
→ sees User B OFF day
```

---

# 34. Seed Data for Development

Create seed data representing realistic usage.

User A:

```text
Smart
phone: 0812345678

Default:
Mon-Fri WORK 07:40-17:00
Sat-Sun OFF

Override:
2026-10-10 WORK 07:40-17:00
```

User B:

```text
Partner
phone: 0899999999
```

Room:

```text
Smart & Partner
```

Events:

```text
2026-10-12
Smart OT 17:20-19:40+

2026-10-08
Partner OFF

2026-12-27 to 2026-12-29
Smart ACTIVITY
Phu Soi Dao
```

---

# 35. Definition of Done for MVP

MVP is complete when:

- Runs outside Google Apps Script
- Uses PostgreSQL
- Works on iPhone Safari
- Phone lookup login works
- Session persists
- User can create room
- User can share invite URL
- Invite user joins directly
- Monthly calendar displays all room members
- Each member sees all member schedules
- Each member edits only their own events
- Multiple events in one date work
- WORK + OT same date works
- Multi-day activity works
- Custom location works
- Custom status works
- Bulk edit works
- Working Saturday override works
- Mobile UX is usable without zoom
- Database migrations are included
- README explains setup and deployment
- No secrets committed
- Tests cover core permission and scheduling logic

---

# 36. Codex Implementation Rules

Codex must follow these constraints:

1. Do not use Google Apps Script.
2. Do not use Google Sheets as the primary database.
3. Do not add Firebase Auth or OTP unless explicitly requested later.
4. Do not silently change the phone-number identity requirement into password authentication.
5. Do not allow client-side-only authorization.
6. Do not use one-record-per-day schedule design.
7. Support multiple events per date.
8. Support multi-day events.
9. Support room-based membership.
10. Support invite URL.
11. Mobile-first iPhone Safari support is mandatory.
12. Use TypeScript strict mode.
13. Keep services and database access separated from React UI.
14. Include migrations and seed data.
15. Include `.env.example`.
16. Include README with exact setup commands.
17. Run lint/typecheck/tests before declaring a milestone complete.
18. Fix build errors instead of documenting them as known issues.
19. Do not invent product requirements that conflict with this blueprint.
20. When requirements are ambiguous, prefer the simplest implementation consistent with this document.

---

# 37. Master Prompt to Give Codex

Copy the section below as the initial Codex prompt.

---

You are implementing a production-quality MVP named **SharedSchedule**.

Read `SHAREDSCHEDULE_BLUEPRINT.md` completely before changing code.

Your task is to implement the project according to the blueprint.

Core technology:

- Next.js
- TypeScript strict mode
- PostgreSQL
- Drizzle ORM preferred
- Tailwind CSS
- HTTP-only session cookie
- Mobile-first design

Important product constraints:

- Do NOT use Google Apps Script.
- Do NOT use Google Sheets as the database.
- Login is intentionally NOT real authentication.
- A user enters a phone number.
- Normalize the phone number and look it up in the database.
- If it exists, create a session.
- If it does not exist, ask for display name and create the user.
- No password.
- No OTP.
- No Firebase Auth.
- Add an explicit README security warning explaining that knowing another member's phone number allows impersonation.

Implement this architecture:

```text
UI
→ Route Handler / Server Action
→ Service
→ Validation / Permission
→ ORM
→ PostgreSQL
```

Primary domain:

```text
User
Room
RoomMember
RoomInvite
StatusMaster
LocationMaster
WorkPattern
WorkOverride
Event
Session
Notification
AuditLog
```

Important event model:

- A date can have multiple events.
- Example:
  - WORK 07:40-17:00
  - OT 17:20-19:40+
- Do not implement one-date-one-status.
- Support multi-day events.
- Support custom statuses.
- Support custom locations.
- Support bulk date editing.
- Support weekly default working patterns.
- Support date overrides such as factory working Saturday.

Permissions:

- All members in the same room can view one another's schedules.
- Members may edit/delete only their own events.
- Room OWNER may manage room configuration, invites, statuses, locations, and members.
- Every write endpoint must validate session, membership, and ownership server-side.

Room invite behavior:

```text
User opens /invite/:token
→ if no session, show phone identity screen
→ after session is established, validate invite
→ join user to room
→ open invited room directly
```

Main screens:

1. Phone identity
2. Room list
3. Monthly shared calendar
4. Day detail bottom sheet
5. Add/edit event
6. Bulk edit
7. Work calendar
8. Room settings

Mobile requirements:

- iPhone Safari is first-class.
- 320px+ width
- 44px minimum touch targets
- safe-area support
- no hover-only UI
- no main-calendar horizontal scrolling
- no zoom required
- mobile-friendly date/time/tel inputs

Calendar performance:

- One request should load the monthly read model.
- Avoid N+1 queries.
- Add indexes.
- Server aggregates weekly patterns, overrides, events, members, statuses, and locations.
- Client should receive a ready-to-render month model.

Development process:

Implement milestone-by-milestone.

After each milestone:

1. run formatter
2. run lint
3. run TypeScript typecheck
4. run tests
5. run production build
6. fix all errors
7. update README / implementation notes
8. make a clear Git commit

Begin with:

**Milestone 1 — Foundation**

Deliver:

- project initialization
- PostgreSQL/Drizzle setup
- complete initial schema
- migrations
- seed data
- responsive application shell
- `.env.example`
- README
- scripts for dev/build/lint/typecheck/test/db migration/db seed

Before coding, produce a short implementation plan and list of files you will create/change. Then implement Milestone 1 fully. Do not start Milestone 2 until Milestone 1 builds and tests successfully.

---

# 38. Recommended First Command to Codex

After placing this file at project root as:

```text
SHAREDSCHEDULE_BLUEPRINT.md
```

use a prompt similar to:

```text
Read SHAREDSCHEDULE_BLUEPRINT.md completely.

This file is the source of truth for the SharedSchedule project.

Inspect the current repository first.

If the repository is empty, initialize the project according to the blueprint.
If code already exists, compare it against the blueprint and preserve anything that is already correct.

Start with Milestone 1 only.

Before editing:
1. summarize the architecture you will implement,
2. identify risks or ambiguities,
3. list the files you plan to create or change.

Then implement Milestone 1.
Run lint, typecheck, tests, and production build.
Fix all failures before stopping.

Do not start Milestone 2 yet.
```

---

# 39. Notes for Later Codex Sessions

Do not ask Codex to implement the entire system in a single giant pass.

Recommended sequence:

```text
Milestone 1
Foundation

Milestone 2
Phone identity/session

Milestone 3
Rooms/invite

Milestone 4
Calendar read model

Milestone 5
Event CRUD

Milestone 6
Bulk edit

Milestone 7
Work calendar

Milestone 8
Master data

Milestone 9
Audit/notification foundation

Milestone 10
Mobile polish/testing
```

For each milestone, ask Codex to:

```text
inspect current repository
read blueprint
implement only requested milestone
run tests/build
commit
stop
```

This keeps the project easier to review and reduces the risk of Codex making large uncontrolled architectural changes.
