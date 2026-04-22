# Event Platform for Workspace Manager — Plan

## Goal
Internal platform where the workspace manager creates events. For each event the platform:
1. Creates a Platform page with the description
2. Lets the manager pick a C-level approver
3. Emails the approver a link to select eligible travelers from HiBob team rosters
4. Shows the approved attendees on the event page

## Tech stack (proposed)
- **Frontend + API**: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- **DB**: Postgres (Supabase or Neon) + Prisma
- **Auth**: none for this iteration (local-only, single-user mode). Add SSO later if we deploy.
- **Email**: Resend or Postmark (verified li.finance sender)
- **Hosting**: Vercel
- **Secrets**: Vercel env vars / 1Password (HiBob token never touches the browser)

## Data model
```
Event
  id, title, description, startDate, endDate, location
  approverId → User
  approvalStatus        # DRAFT | SENT | COMPLETED
  approvalToken
  createdById, createdAt, updatedAt

User                    # workspace managers + C-level approvers
  id, email, displayName, role

EventTeam               # teams attached to an event (many-to-one → Event)
  id, eventId, hibobDepartmentId, displayName

ApprovedAttendee
  id, eventId, hibobEmployeeId, displayName, email, department, approvedAt
```

## User flows

### 1. Workspace manager creates event
1. `/events/new` form: title, description, dates, location
2. Pick one or more **teams** (multi-select, sourced from HiBob departments)
3. Pick one **C-level approver** from a hard-coded dropdown
4. Submit →
   - Insert `Event` + `EventTeam` rows
   - Generate single-use approval token
   - Email approver with magic link
   - `approvalStatus = SENT`

### 2. Approver selects attendees
1. Approver clicks email link → `/approve/:token`
2. Page shows event summary + employees from every attached team (server-side fetched from HiBob, deduped, active only)
3. Filter by team, search by name, multi-select, submit
4. Replace `ApprovedAttendee` rows, set `approvalStatus = COMPLETED`
5. Optional confirmation email to workspace manager
6. Link stays valid — approver can revisit and edit the list; re-submitting replaces the previous selection

### 3. Event detail page
- Event metadata
- Approver + approval status
- Table of approved attendees (name, email, team)
- Resend / rotate approval link action (manager only)

## External integrations

### HiBob (Bob API)
- Base URL: `https://api.hibob.com`
- Auth: Service User token → `Authorization: Basic base64(serviceUserId:token)`
- Endpoints:
  - `POST /v1/people/search` — list active employees, return fields `/root/id`, `/root/displayName`, `/work/email`, `/work/department`, `/work/title`
  - `GET /v1/company/named-lists/department` — departments for the team picker
- Cache department list ~1h; fetch people on demand per selected team
- All calls server-side; token never sent to the browser

### Email (Resend/Postmark)
- Verified sending domain on li.finance
- Templates: `approver_request`, `approval_completed_confirmation`

## HiBob Service User permissions needed

Create a **Service User** in Bob (Settings → Integrations → Service Users) with these **read-only** permissions:

| Category | Permission | Why |
|---|---|---|
| People | View **employees' basic info** of all employees | name, display name, work email |
| People | View **employees' work info** of all employees | department, title, manager |
| People | View **employment info** (optional) | filter to active employees |
| Company | View **company's named lists** | department list for the team picker |

**Do NOT grant**:
- Any `sensitive`, `personal`, `financial`, `compensation`, `payroll`, or `time-off` read permissions
- Any write / update / delete permissions
- Admin or impersonation permissions

When you provide the token, share both the **Service User ID** and the **token** (1Password, not chat).

## Implementation phases

| Phase | Scope | Est. |
|---|---|---|
| 0 | Repo, local Postgres, env scaffolding (skip SSO for now — local mode) | 0.5d |
| 1 | HiBob client + `/api/hibob/departments`, `/api/hibob/departments/:id/people` | 1d |
| 2 | Event creation form + DB persistence | 1.5d |
| 3 | Approval magic-link email + approver page + submission (re-editable) | 1.5d |
| 4 | Event detail page + audit log | 0.5d |
| 5 | Polish, empty/error states, resend flow | 0.5d |

## Acceptance criteria
- [ ] Runs locally; no auth / access control for this iteration
- [ ] Manager can create an event with title, description, dates, location, ≥1 team, 1 approver (from hard-coded C-level list)
- [ ] Approver receives an email with a unique link within 1 minute
- [ ] Approval link does not expire; approver can revisit and edit their selection at any time
- [ ] Approver page lists every employee from every attached team, deduped, active only
- [ ] Approver can filter by team, search by name, multi-select, and submit
- [ ] Re-submitting the approval replaces the previous attendee list
- [ ] Event detail page shows approved attendees (name, email, team) after submission
- [ ] Approval status is visible to the manager (DRAFT / SENT / COMPLETED)
- [ ] HiBob token is server-side only; never exposed to the browser or client bundles
- [ ] Manager can resend the approval email (re-uses the same link)
- [ ] Audit log: creator, approver, timestamps of key state changes

## Decisions (resolved)
1. **Approver list** → hard-coded list of C-levels (config file)
2. **"Team" in HiBob** → Department field
3. **Token lifetime** → no expiry, re-editable
4. **Event detail visibility** → no access control for now (local-only)
5. **Post-approval edits** → allowed; re-submit replaces
