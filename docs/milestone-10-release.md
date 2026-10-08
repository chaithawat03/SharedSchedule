# Milestone 10 release verification

## Dedicated PostgreSQL on Windows

Use a new, disposable database named `sharedschedule_m10_test`. Never use an application, development, or production database for the integration or browser suites. This checkout has no usable local PostgreSQL service or Docker, so the live steps below must be run on a machine where PostgreSQL is already available. Do not run `db:seed` on this database.

With an existing local PostgreSQL installation, create the database with `psql` or `createdb`. For the repository's optional Compose service, if it is already installed and running:

```powershell
docker compose --env-file .env.local exec -T db psql -U sharedschedule -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE sharedschedule_m10_test"
```

Set the private password from your local PostgreSQL setup without putting it in a tracked file. The database name must include `test`; verify the host and name before continuing. In the same PowerShell session:

```powershell
$env:TEST_DATABASE_URL = "postgresql://sharedschedule:<private-password>@localhost:5432/sharedschedule_m10_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:migrate
npm run db:migrate
```

The first migration run must apply `0000_sticky_outlaw_kid`, `0001_default_room_statuses`, and `0002_long_cammi` to an **empty** database. The second run must finish without applying new migrations or changing the schema. Check the Drizzle ledger, which should contain exactly three rows, before running tests:

```powershell
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;'
npm test
```

If only Compose has `psql`, run the ledger query with `docker compose --env-file .env.local exec -T db psql -U sharedschedule -d sharedschedule_m10_test -c 'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;'`. Compare the ledger before and after the second migrate. `npm test` must report **zero skipped PostgreSQL cases** and no failures. Integration suites also call the migrator; they check transactions for sessions, rooms and invites, calendar, event CRUD and bulk operations, work schedules, master data, notifications, and audit records. A local non-DB test run does not satisfy this gate.

For browser coverage, build and run against the same dedicated test database after the integration suite finishes. The Playwright configuration starts its own app on port 3101 and rejects a database URL without `test` in the database name. Keep other apps off that port. Install browser binaries where permitted, then run:

```powershell
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

Browser tests create disposable users and rooms in the dedicated database. Use a fresh disposable database for each release attempt; do not aim them at ordinary development data. Playwright WebKit is a useful regression proxy, but it does not replace an iPhone Safari check.

## Code verification

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Record the exit code of each command and the test pass/fail/skip counts from this checkout. `npm test` without `TEST_DATABASE_URL` verifies the non-database tests only; skipped PostgreSQL suites are **UNVERIFIED**, not passed. A successful build does not verify a database or a device.

## Environment verification

| Gate                                                           | Current status | Required evidence                                                                                                                    |
| -------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Fresh PostgreSQL migrations, including a second idempotent run | **UNVERIFIED** | Run the two `npm run db:migrate` commands above on an empty dedicated test database and inspect the three-row Drizzle ledger.        |
| Live PostgreSQL integration tests                              | **UNVERIFIED** | Set `TEST_DATABASE_URL` to that database, run `npm test`, and report zero skipped database cases.                                    |
| Playwright browser projects                                    | **UNVERIFIED** | Build, install Chromium and WebKit, run `npm run test:e2e` with `TEST_DATABASE_URL`, and record results for each configured project. |
| iPhone Safari                                                  | **UNVERIFIED** | Complete the iPhone checklist below on actual hardware.                                                                              |
| Android Chrome                                                 | **UNVERIFIED** | Complete the Android checklist below on actual hardware.                                                                             |

Do not count a skipped browser suite or local non-database test run as environment verification. Report the exact pass/fail/skip counts and any unrun gates. **Do not call the MVP production-ready until the PostgreSQL, browser, and real-device release gates are completed.** Playwright WebKit does not substitute for iPhone Safari.

## Manual device checklist

Mark each item only after testing on hardware. Use test identities and a test database or an isolated staging environment.

### iPhone Safari

- [ ] Around 320px and a current larger iPhone, portrait and landscape: Rooms, Calendar, Work Calendar, Settings, Notifications, invite, and identity pages have no page-wide horizontal overflow.
- [ ] Safari toolbar shown and hidden, keyboard visible, and home indicator safe area: dialog fields and bottom actions remain reachable.
- [ ] Day Detail, event and bulk editors, Work Calendar, and master editor: open, scroll, Escape or close, cancel, and focus return work; rotate while an editor is open.
- [ ] Month grid stays readable with many entries; day details expose full information; month navigation works.
- [ ] Native telephone, date, time, and month controls work without losing the selected value.
- [ ] Invite copy and manual selection fallback work. Identity entry and registration work.
- [ ] VoiceOver announces day state, labels, errors, and actions. Check enlarged text and reduced motion.

### Android Chrome

- [ ] Small and typical widths and both orientations: no page-wide overflow; calendar day actions remain usable.
- [ ] Keyboard, native date/time/month pickers, dialog scrolling, focus, and Android Back behavior work.
- [ ] Month navigation, bulk selection, form validation errors, and read-only retry after temporary network failure work.
- [ ] TalkBack announces day state, form labels, errors, and controls.

### Both platforms

- [ ] Check long room and member names, long notes, multiple members, many events, and an empty room.
- [ ] Check slow and offline networks, expired session, invalid/expired invite, and retry after network recovery.
- [ ] Confirm a successful mutation followed by a failed calendar refresh offers a read-only retry and does not repeat the write.
- [ ] Confirm room Settings appears only for the owner and nonowners cannot write through the API.

## Deployment and security review

- Phone number lookup **identifies a profile but does not authenticate a person**. Anyone who knows a phone number can assume that identity, including room owner authority. This is a known product limitation, and access to personal schedules should not be offered to untrusted public users until an authentication decision is made. OTP is outside Milestone 10.
- Terminate HTTPS at the trusted proxy and keep the public site on HTTPS. Session cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `NODE_ENV=production`; verify production sets that environment value and forwards cookies correctly.
- Invite URLs use `request.nextUrl.origin`. The proxy must pass the intended public scheme and host, and must reject untrusted Host/forwarded host values. Verify a generated invite URL on staging. Treat invite URLs as bearer secrets and avoid logging or exposing them.
- Store `DATABASE_URL`, proxy credentials, and other secrets in the deployment secret store, not the repository or client bundle. Protect database connections and establish tested backups and restore procedures before deployment.
- Capture production server errors and alert on failed writes and repeated request failures without logging phone numbers, session cookies, invite tokens, or private notes. Confirm logging and retention with the operator.
- Login and invite endpoints have no application rate limit. Add an upstream abuse control before public exposure; do not rely on obscurity or the random invite token alone.
- Cookie-backed writes rely on `SameSite=Lax` and server authorization. Review same-site subdomains, Origin/Host handling, and CSRF policy at the deployment proxy. There is no dedicated CSRF token mechanism in this milestone.
- Server checks for membership, owner authority, event ownership, and current notification access remain mandatory; UI hiding is only presentation.
