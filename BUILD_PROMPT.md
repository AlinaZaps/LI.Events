# Build Prompt — Event Platform MVP

You are building an internal event-management platform for li.finance's workspace manager. Work in this directory: `/Users/alinazaprudska/coding/li.fi/vibe-a-thon`.

## Read first, in this order
1. `PLAN.md` — full product spec, data model, flows, acceptance criteria. Treat it as the source of truth for *what* to build.
2. `design/tokens.css` and `design/tokens.ts`. These are the source of truth for *how it looks*: color palette, typography, spacing, radii, shadows, dark/light mode. They were already distilled from the original `bd_event_platform_{branded,light}.html` references; use them directly rather than re-extracting. Port them into `tailwind.config.ts` and `app/globals.css` verbatim — do not rename, reshape, or round the values.

If `PLAN.md` and the design tokens disagree on anything cosmetic (colors, typography, spacing, radii, shadows), the tokens win. If they disagree on behavior or data, `PLAN.md` wins. Component *layout and shape* are not prescribed by the tokens: use shadcn/ui defaults restyled with the tokens. Do not invent new colors, fonts, radii, or shadows; component composition (what goes next to what) is left to your judgment within the token system.

## Scope — MVP only
Build the following, and nothing else:

1. **Setup**
   - Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui
   - Local Postgres via Docker Compose (`docker-compose.yml` with a `postgres:16` service)
   - Prisma with the schema from `PLAN.md` → data model section
   - `.env.example` committed; `.env.local` git-ignored
   - `README.md` with setup steps (clone → `pnpm install` → `docker compose up -d` → `pnpm prisma migrate dev` → `pnpm dev`)
   - No auth. Single-user local mode.
   - Dark/light mode via `next-themes`, toggle in the top bar, tokens driven by the design files. Add `suppressHydrationWarning` on `<html>` to avoid SSR hydration noise.
   - `prisma/seed.ts` wired as `prisma.seed` in `package.json` and run automatically on `pnpm prisma migrate dev`. Seeds:
     - One `User` with `role='MANAGER'`, `email='manager@local'`, stable id `manager` — used as `Event.createdById` for every event and as `AuditLog.actor='manager'`
     - One `User` per entry in `APPROVERS` (see section 3) — `id = approver.key`, `role = 'APPROVER'`, email/displayName copied from config. Re-running the seed upserts, so editing the config propagates.

2. **HiBob integration (server-side only)**
   - Env vars: `HIBOB_SERVICE_USER_ID`, `HIBOB_API_TOKEN`
   - **Credentials live in 1Password**, item titled **"Hackathon - LI.Events (HiBob)"** (username = service user id, password = API token). Do not hard-code, do not commit, do not echo to any log or tool output. Two supported ways to wire them in locally — pick one:
     1. **Manual copy**: open the 1Password item, paste `username` → `HIBOB_SERVICE_USER_ID` and `password` → `HIBOB_API_TOKEN` in `.env.local` (git-ignored).
     2. **1Password CLI** (preferred if `op` is installed): reference the values by secret path in `.env.local`, e.g.
        ```
        HIBOB_SERVICE_USER_ID=op://<vault>/Hackathon - LI.Events (HiBob)/username
        HIBOB_API_TOKEN=op://<vault>/Hackathon - LI.Events (HiBob)/password
        ```
        and run the dev server under `op run --env-file=.env.local -- pnpm dev`. This keeps secrets out of files on disk. (Ask Alina for the exact vault name; `op vault list` enumerates what you can see.)
   - `.env.example` ships with both keys blank and a comment pointing at the 1Password item title. Never put real values in `.env.example`.
   - Build `src/lib/hibob.ts` with:
     - `listDepartments()` → `GET /v1/company/named-lists/department`
     - `listEmployeesByDepartments(departmentNames: string[])` → `POST /v1/people/search` with this body shape:
       ```json
       {
         "fields": ["/root/id", "/root/displayName", "/work/email", "/work/department", "/work/title"],
         "filters": [
           { "fieldPath": "/work/department", "operator": "equals", "values": ["<name1>", "<name2>"] }
         ],
         "humanReadable": "REPLACE",
         "showInactive": false
       }
       ```
       Department filtering is **by name string**, not id (HiBob's `/work/department` is the name). Pass `EventTeam.displayName` here; `hibobDepartmentId` is stored for stability but not used for people search. Before shipping, verify the exact filter schema against the HiBob docs you authenticate against — if the API rejects the body, log the raw response (server-side only; see workflow rules) and fail loudly rather than guessing a mapping.
   - Auth header: `Authorization: Basic base64(serviceUserId:token)`
   - 1-hour in-memory cache for departments
   - API routes: `GET /api/hibob/departments`, `POST /api/hibob/employees` (body: `{ departments: string[] }`)
   - HiBob token must never appear in client bundles — verify by grepping `.next` after build

3. **Event creation (workspace manager)**
   - Route: `/events/new`
   - Form fields: title, description (textarea; stored as plain text, rendered as escaped plain text with line-break preservation — no markdown rendering in this MVP), startDate, endDate, location, teams (multi-select populated from `/api/hibob/departments`), approver (single-select from a hard-coded list in `src/config/approvers.ts`)
   - Approver config shape:
     ```ts
     // src/config/approvers.ts
     export const APPROVERS = [
       { key: 'ceo', displayName: 'CEO (placeholder)', email: 'ceo-placeholder@li.finance', role: 'CEO' },
       { key: 'coo', displayName: 'COO (placeholder)', email: 'coo-placeholder@li.finance', role: 'COO' },
       { key: 'cto', displayName: 'CTO (placeholder)', email: 'cto-placeholder@li.finance', role: 'CTO' },
     ] as const
     ```
     Reconciling with `PLAN.md`'s `Event.approverId → User` FK: the seed script (see section 1) upserts one `User` row per `APPROVERS` entry using `key` as the stable id. The form submits `approverId = approver.key`; the UI reads display data from the `User` row so the DB stays the source of truth once the event is written.
   - On submit:
     - Validate with zod (including `startDate <= endDate`, non-empty title, ≥1 team)
     - Insert `Event` + `EventTeam` rows (in a single Prisma `$transaction`)
     - Generate an unguessable approval token (`crypto.randomBytes(32).toString('base64url')`). `Event.approvalToken` has a **unique index** in the Prisma schema
     - Send email to approver via Resend (stub the actual send behind an env flag `EMAIL_MODE=log|resend` — in `log` mode just console.log the recipient, subject, and full `${APP_BASE_URL}/approve/${token}` link; default to `log` so dev doesn't require a Resend key)
     - Set `approvalStatus = SENT`
     - Redirect to event detail page

4. **Approver page (public via token)**
   - Route: `/approve/[token]`
   - No auth — holding the token is the authorization
   - Shows event summary (title, dates, location, description)
   - Shows employees from all attached teams, server-side fetched and deduped by `hibobEmployeeId`, active-only
   - **Stale-attendee handling**: also include anyone already in `ApprovedAttendee` who is *not* in the current HiBob fetch (left company, changed department, inactive). Render these rows disabled + pre-checked with a "no longer on team" badge. On submit they stay approved unless the approver explicitly unchecks them — do not silently drop them.
   - Filter chips per team, search box by name, checkbox per person
   - Pre-checks anyone already in `ApprovedAttendee` so re-editing works
   - Submit runs in a single Prisma `$transaction`: delete existing `ApprovedAttendee` rows for this event, insert new ones, set `approvalStatus = COMPLETED`, write audit log. Concurrent submits resolve by last-writer-wins at transaction commit.
   - Success state with a "You can come back and edit this anytime — bookmark this link or ask the workspace manager to resend it" note

5. **Event list + detail (workspace manager)**
   - `/events` — table of events with title, dates, approver, status, #approved
   - `/events/[id]` — event metadata, approver + status, approved attendees table (name, email, team), "Resend approval email" button that re-sends to the same token (**no rotation** — this supersedes `PLAN.md`'s "rotate" language; tokens have no expiry, so rotating would only break any bookmarks the approver saved without adding security. If rotation becomes a requirement, make it a separate explicit action.)

6. **Audit log (minimal)**
   - An `AuditLog` table: `id, eventId, actor, action, createdAt, payloadJson`
   - `actor` is a string, one of: `'manager'` (the seeded workspace-manager user), `'approver:<key>'` (e.g. `'approver:ceo'`), or `'system'` (e.g. async email dispatch)
   - Log these actions: `event.created` (`manager`), `approval.email_sent` (`system`), `approval.submitted` (`approver:<key>`, first submission), `approval.updated` (`approver:<key>`, subsequent submissions), `approval.email_resent` (`manager`)
   - Surface the log as a collapsed section on the event detail page

## Explicitly out of scope for MVP
- Auth / SSO / access control
- Perk integration
- Notion integration
- Deployment / Vercel config
- Tests beyond one happy-path integration test for the approval flow
- Notifications to attendees (Perk would own this in the real product; not our problem now)
- Rate limiting, observability, error tracking

## Design fidelity
- Pull the color tokens, radii, shadows, and typography scale from `design/tokens.css` and `design/tokens.ts` into `tailwind.config.ts` and `app/globals.css`
- Both light and dark mode must match the tokens — don't approximate
- Use shadcn/ui components but restyle them against the tokens; don't ship default shadcn colors
- Empty states and loading skeletons should exist and be styled, not placeholder text

## Tech conventions
- `pnpm` as package manager
- Server Components by default; `"use client"` only where needed (forms, theme toggle, interactive tables)
- Server Actions for mutations; API routes only for HiBob proxy endpoints
- Prisma client singleton in `src/lib/db.ts`
- Zod schemas colocated with the server action that uses them
- No `any`. No ignoring lint. No suppressing TS errors.
- Commits: one per logical step, conventional-commit style

## Environment variables (full list)
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/vibe_a_ton
HIBOB_SERVICE_USER_ID=
HIBOB_API_TOKEN=
EMAIL_MODE=log            # log | resend
RESEND_API_KEY=           # only needed when EMAIL_MODE=resend
EMAIL_FROM=events@li.finance
APP_BASE_URL=http://localhost:3000
```

## Build order
1. Scaffold Next.js + Tailwind + shadcn + Prisma + Docker Postgres; get `pnpm dev` running against an empty DB
2. Apply design tokens from `design/tokens.css` / `design/tokens.ts`; build a `ThemeToggle` and confirm light/dark swap cleanly on a blank page
3. Prisma schema + first migration
4. HiBob client + department/employee API routes; smoke-test with a real token
5. Event creation form wired to DB (no email yet)
6. Email dispatch behind `EMAIL_MODE` flag
7. Approval page with full selection UX
8. Event list + detail + resend action
9. Audit log writes + detail-page display
10. One Playwright or Vitest integration test covering: create event → approve via token → approved list visible on detail page

## Done definition
Every box in `PLAN.md` → Acceptance Criteria is checked, with one carve-out: the "approver receives an email within 1 minute" criterion applies only when `EMAIL_MODE=resend`; in the default `log` mode, a console log with subject + link within 1s plus an `approval.email_sent` audit row satisfies it. `pnpm build` passes with no TS or ESLint errors. `pnpm dev` boots against a fresh database after `pnpm prisma migrate dev` (which runs the seed), with no manual SQL. Design matches `design/tokens.css` / `design/tokens.ts` in both light and dark modes.

## Workflow rules for you, the builder
- After each step in the build order, stop and summarize in one short message what you changed before moving on
- Do not invent colors, fonts, radii, or shadows outside `design/tokens.css` / `design/tokens.ts` — component layout within the token system is your call
- Do not add features, fields, or pages not listed above — if something seems missing, ask before adding
- If HiBob returns an unexpected shape, surface the raw response in **server logs and manager-facing error UI only** (`/events/*`). On the public approver page (`/approve/[token]`), show a generic "Couldn't load team roster — try again shortly" and keep the raw response out of the rendered HTML. Never guess a mapping.
- Never commit `.env.local`, never print the HiBob token to logs
