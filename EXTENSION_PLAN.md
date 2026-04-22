# LI.Events — Extension Plan (Functionality Only)

> Ordered easiest → hardest. Design system is already in place (see BUILD_PROMPT.md for tokens). **Do not touch CSS beyond what each step strictly requires.** Each step is an independent, demo-ready slice.
>
> **What exists today**: Event create/list/archive, HiBob department+employee fetch, approver magic-link flow, approved-attendee list, audit log, dashboard (basic counts).
>
> **Demo posture**: Every step must land something visible in the UI within one sitting. No half-wired features.

---

## Mock data source (Moss)

Real LI.FI Q1 2026 marketing spend — **sanitized** — lives at [`src/lib/mock/moss-spend.json`](src/lib/mock/moss-spend.json). Use this as the "live Moss feed" stand-in for every step that needs event spend.

**What's in it** (sanitized from `LI.FI Marketing Spend Analysis Q1 2026.xlsx`):
- `_meta` — period, currency (EUR), totals, sanitization notes
- `categories` — 13 spend categories with EUR amount + % of total (€549,606.34 Q1 total)
- `events` — 5 real conferences with travel / tickets / events / sponsorships / total / attendee count / cost-per-person:
  - **ETHDenver 2026** — €66,450.57 · 8 attendees
  - **EthCC Cannes 2026** — €110,535.33 · 12 attendees
  - **DAS NYC 2026** — €25,465.85 · 2 attendees
  - **Consensus Hong Kong 2026** — €13,492.60 · 3 attendees
  - **CFC St. Moritz 2026** — €12,290.12 · 2 attendees
- `lineItems` — 34 per-event line items: anonymized label (`traveler_1`, `traveler_2`, `sponsorships`, `conference_events_venue`, etc.), category, amount, short description

**Privacy guarantees (do not break these):**
- No employee names, emails, invoice numbers, or card/account data.
- Travelers are numbered per event; there is no mapping back to real people in this file.
- Descriptions are truncated to 80 chars and stripped of personal identifiers.
- If a later step needs real attendee names for the demo, source them from HiBob via the existing flow — **never** hard-code names in seeds or mock files.

**How to use it:**
- `prisma/seed.ts` reads this file at seed time to populate `Event.budgetCents` and `Event.spentCents` (Step 1) and to create `Invoice` rows (Step 8).
- The "Moss" integration card (Step 10) can surface `_meta.period` and totals directly.

---

## Step 0 — Ground rules for the implementing LLM

Before each step:
1. Read `prisma/schema.prisma` and the relevant page under `src/app/` to understand current state.
2. Any new model: add to `prisma/schema.prisma`, run `pnpm prisma migrate dev --name <step>`, update `prisma/seed.ts` with demo data, re-seed.
3. New API routes go under `src/app/api/<resource>/route.ts` using the existing Prisma client in `src/lib/db.ts` (or whatever that file is called — confirm first).
4. Server components by default; client components only where interactivity demands it (`"use client"` + a form hook).
5. Validate inputs with `zod` (already installed).
6. Every new feature must have seed data rich enough to look real in screenshots — no empty states on the demo path.
7. After each step: manually click through the flow, take a screenshot, commit. One commit per step.

---

## Step 1 — Event budget + category + status *(foundation, ~1h)*

**Why first**: unlocks 4 downstream steps (dashboard stats, pipeline-by-event, budget widget, ROI). Tiny schema change, instant visible payoff.

**Schema**
```prisma
model Event {
  // existing fields...
  category       EventCategory @default(CONFERENCE)
  lifecycleStatus EventStatus  @default(UPCOMING)
  budgetCents    Int           @default(0)
  spentCents     Int           @default(0)
}

enum EventCategory { CONFERENCE SIDE_EVENT HACKATHON BD_DINNER SPONSORSHIP }
enum EventStatus   { PAST UPCOMING LIVE }
```

**UI**
- `/events/new` form: add `category` select + `budget` number input.
- `/events/[id]`: add **Budget card** — 3-box grid (allocated / spent / remaining), progress bar (`gc(pct)` for color: >90 red, >60 amber, else pink→purple gradient), `X% spent · live via moss` caption.
- Event list + detail: show status pill (past/upcoming/live) with correct tag colors from BUILD_PROMPT §Tag color reference.

**Seed**: read [`src/lib/mock/moss-spend.json`](src/lib/mock/moss-spend.json) and for each of the 5 conferences create (or upsert by name) an `Event` with:
- `name` = `events[i].name`
- `category` = `CONFERENCE`
- `lifecycleStatus` = `PAST` (Q1 2026 is historical relative to today)
- `spentCents` = `events[i].total * 100`
- `budgetCents` = `round(events[i].total * 1.10 / 1000) * 1000 * 100` — i.e. ~10% headroom over actual, rounded to the nearest €1k, so the Budget card shows a realistic 80–95% spent ratio
- Exception (for demo variety): set **EthCC Cannes 2026** budget to `€100,000` so it renders as over-budget (red state, >100%).

Use EUR as the base currency for display (the file is in EUR; do not fake a $ conversion).

**Demo line**: "Budgets come straight from Moss. EthCC overran — we caught it here before finance did."

---

## Step 2 — Dashboard overhaul *(~1–2h, pure aggregation)*

**Why next**: no new models, massive visual upgrade. Uses Step 1 data + mocked pipeline numbers until Step 7 lands real deals.

**UI** (replace `/` page content):
- **Top stats row (4)**: `events_2026` (count + YoY delta), `annual_spend` (sum `spentCents`), `pipeline` (sum from Deals, mocked for now), `revenue_won` (mocked).
- **Second stats row (4)**: `meetings_set`, `targets_met`, `late_booking_tax`, `roi` — all mocked constants with a `// TODO: wire when Step 7 lands` comment.
- **Two-column grid**:
  - Left: `pipeline_by_event` — horizontal progress bars per event (bar = pipeline vs max pipeline), pink value label.
  - Right: `pending_approvals` — query Events where `approvalStatus = SENT`, show inline approve/reject. Reuse existing approve endpoint.
- **Events overview table**: every event, budget %, status badge, clickable → `/events/[id]`.

Stats go in a shared `src/lib/stats.ts` (server-only) so other views can reuse.

**Demo line**: "One screen. Six tools killed."

---

## Step 3 — Schedule / Timeslots per event *(~1h)*

**Schema**
```prisma
model Timeslot {
  id       String   @id @default(cuid())
  eventId  String
  event    Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  time     String   // "09:00" — string, not DateTime, to stay simple
  title    String
  person   String?
  type     TimeslotType
  createdAt DateTime @default(now())
}
enum TimeslotType { SPEAKER PANEL WORKSHOP BOOTH DINNER MEETING }
```

**UI**
- Event detail `/events/[id]`: add **Schedule card** — rows of `time | title | person | type-badge`, `+ slot` button opens `add-timeslot` modal (matches BUILD_PROMPT modal spec).
- API: `POST /api/events/[id]/timeslots`, `DELETE /api/timeslots/[id]`.

**Seed**: 3–5 timeslots per live/upcoming event (keynote, panel, LI.FI dinner).

**Demo line**: "Every side dinner, every speaking slot — one page, one source of truth."

---

## Step 4 — Side events *(~30min, trivially small)*

**Schema**
```prisma
model SideEvent {
  id       String   @id @default(cuid())
  eventId  String
  event    Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name     String
  startsAt DateTime
  host     String?
  lumaUrl  String?
}
```

**UI**
- Event detail sidebar: **Side events card** with pink `→` prefixed rows. `+ add` → modal.
- API: `POST /api/events/[id]/side-events`.

**Seed**: 2 side events per major conference.

---

## Step 5 — Target list (BD targets) *(~2h)*

**Why here**: standalone page + per-event widget. Self-contained, high demo value.

**Schema**
```prisma
model Target {
  id         String    @id @default(cuid())
  eventId    String?
  event      Event?    @relation(fields: [eventId], references: [id], onDelete: SetNull)
  name       String
  company    String
  jobTitle   String?
  priority   Priority  @default(MEDIUM)
  ownerId    String?
  owner      User?     @relation(fields: [ownerId], references: [id])
  status     TargetStatus @default(PENDING)
  dealValueCents Int?
  note       String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
enum Priority     { HIGH MEDIUM LOW }
enum TargetStatus { NEW PENDING MET LOST }
```

**UI**
- New route `/targets`: filter tabs (`all | high_priority | met | pending`), table with avatar + name, company, event (purple mono), priority dot, owner select (inline, updates via PATCH), status pill, deal value. `+ add_target` pink button top-right → modal. Row action: `note` → opens `add-note` modal.
- Sidebar nav: add `Targets` with badge = total target count.
- Event detail sidebar: **Targets card** showing targets for this event, `+ add_target`.
- API: full CRUD under `/api/targets`.

**Seed**: 15–25 targets across events, mix of priorities and statuses.

**Demo line**: "We know who we want to meet, who owns them, and whether we've closed them."

---

## Step 6 — Attending / People per event *(~1h)*

Today we store `ApprovedAttendee` (HiBob-sourced). Extend with **non-HiBob people** (speakers, hosts).

**Schema**: new model, don't disturb `ApprovedAttendee`:
```prisma
model EventPerson {
  id       String   @id @default(cuid())
  eventId  String
  event    Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name     String
  role     String?
  colorHex String   @default("#7c6ff7")
  tags     String[] // ['Speaker', 'Lead', ...]
  capacity PersonCapacity @default(ATTENDING)
}
enum PersonCapacity { ATTENDING SPEAKING HOSTING SPONSORING BOOTH }
```

**UI**
- Event detail sidebar: **Attending card** — merges `ApprovedAttendee` + `EventPerson` into one list with colored avatar (bg = color @ 22% opacity, border @ 44%). `+ add` → `add-person` modal.
- API: `/api/events/[id]/people`.

---

## Step 7 — Pipeline / Deals + Kanban *(~3h, core wow moment)*

**Schema**
```prisma
model Deal {
  id         String   @id @default(cuid())
  eventId    String?
  event      Event?   @relation(fields: [eventId], references: [id], onDelete: SetNull)
  name       String
  company    String
  amountCents Int
  stage      DealStage @default(OPEN)
  ownerId    String?
  owner      User?    @relation(fields: [ownerId], references: [id])
  closeDate  DateTime?
  hubspotId  String?  // null for manually created, set when synced
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
enum DealStage { OPEN MEETING QUALIFIED PROPOSAL WON LOST }
```

**UI**
- New route `/pipeline`:
  - 4 stat cards (total pipeline pink, closed won green, in progress amber, avg deal purple).
  - Kanban: 5 columns (`open | meeting | qualified | proposal | won`). Drag-and-drop via `@dnd-kit/core` (add dep). On drop → PATCH stage.
  - `all_deals` table below kanban: name, company, source event (purple mono), owner, amount, stage pill, close date.
- Event detail: **HubSpot deals card** — deals filtered to this event, `synced` green badge in header. Empty state with `add_one →` link.
- Dashboard: replace mocked pipeline number (Step 2) with real sum.
- API: `/api/deals` (GET/POST), `/api/deals/[id]` (PATCH/DELETE).

**Seed**: 15–20 deals across stages, most tied to past/upcoming events, a handful with `hubspotId` set.

**Demo line**: "Drag a card from meeting-set to qualified — that's a conference conversation turning into a deal."

---

## Step 8 — Invoices upload *(~1.5h)*

**Schema**
```prisma
model Invoice {
  id         String   @id @default(cuid())
  eventId    String
  event      Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  fileName   String
  fileUrl    String   // blob URL
  amountCents Int
  category   String?
  notes      String?
  uploadedAt DateTime @default(now())
}
```

**Storage**: Vercel Blob (`@vercel/blob`) for demo simplicity. `BLOB_READ_WRITE_TOKEN` env var.

**UI**
- Event detail: **Invoices card** — PDF-icon rows, download button. Bottom: dashed pink border drop zone (`upload-invoice` modal with file input, amount, category, notes).
- When an invoice is uploaded, auto-increment `Event.spentCents` by the amount.
- API: `POST /api/events/[id]/invoices` (multipart), `GET /api/invoices/[id]/download`.

**Seed**: read `lineItems[]` from [`src/lib/mock/moss-spend.json`](src/lib/mock/moss-spend.json) and create one `Invoice` per line item. Mapping:
- `fileName` = `"${event-slug}-${label}.pdf"` (e.g. `ethdenver-2026-traveler_1.pdf`)
- `fileUrl` = placeholder (`/placeholder-invoice.pdf`) — no real file upload needed for seed data
- `amountCents` = `item.amount * 100`
- `category` = `item.category` (`travel` | `tickets` | `events` | `sponsorships` | `other`)
- `notes` = `item.description`
- `uploadedAt` = synthetic date in Q1 2026, spread across Jan–Mar

Result: EthCC Cannes shows ~13 line items, ETHDenver shows ~9, etc. — the Invoices card looks populated from the first load. **Do not** add any employee names, even as display-only; the anonymized `traveler_N` labels are the source of truth.

**Demo line**: "Every flight, every booth, every sponsorship — one card. Moss syncs in, budget updates live."

---

## Step 9 — Public page `/events/public` *(~2h)*

**Why here**: reuses everything above, no new models beyond one `publishedAt` flag.

**Schema**: add `publishedAt DateTime?` to `Event`.

**UI**
- New route `/events/public` (no auth): lists all events with `publishedAt != null`, filter by city/role tag.
- New route `/events/public/[slug]`: hero card (event name, date, location), **Appearances** list (speakers/sponsors/hosting/booth from `EventPerson` where `capacity != ATTENDING`), Calendly embed per person (static URL field on `EventPerson`).
- Event detail (internal): add `share_public_page` action in hero → `share-page` modal with copy URL + `Publish / Unpublish` toggle.

**Demo line**: "Partners see one page — every LI.FI face at ETHConf, Calendly-ready."

---

## Step 10 — Integrations page *(~1h, mostly cosmetic but ties the narrative)*

**Schema**
```prisma
model IntegrationStatus {
  id         String   @id @default(cuid())
  key        String   @unique // 'moss' | 'perk' | 'hubspot' | ...
  category   String
  status     IntegrationState @default(NOT_CONNECTED)
  lastSyncAt DateTime?
  metadata   Json?   // { deals: 12, pipeline: 284000 } for HubSpot etc.
}
enum IntegrationState { CONNECTED PENDING NOT_CONNECTED }
```

**UI**
- New route `/integrations`: 2×2 grid by category (spend_tracking, crm_pipeline, scheduling, content_&_social, logistics, submissions). Rows per BUILD_PROMPT §Integrations.
- HubSpot card: display `last_sync: Xh ago · N deals · M contacts · €Xk pipeline` computed from the `Deal` table (real) — the rest can be read from the `metadata` JSON.
- Moss card: display `Q1 2026 · €549,606 total spend · €338,422 conference-related` sourced from `_meta` in [`src/lib/mock/moss-spend.json`](src/lib/mock/moss-spend.json). This makes the card feel live without any real Moss API call.
- `sync_hubspot` modal (from BUILD_PROMPT modal spec) with a `↻ sync_now` button → **Step 11**.

---

## Step 11 — HubSpot sync (real or realistic-mock) *(~3–4h)*

**Goal**: clicking `↻ sync_now` pulls deals from HubSpot into `Deal` table.

**Options**:
- **Real**: HubSpot private-app token in env. `GET /crm/v3/objects/deals` with properties `dealname, amount, dealstage, closedate, hs_object_id, hubspot_owner_id`. Map `dealstage` → our `DealStage` enum. Upsert by `hubspotId`.
- **Mock** (recommended for demo unless a real sandbox exists): seed a JSON at `src/lib/mock/hubspot-deals.json`, "sync" = read + upsert with a 1.5s artificial delay and progress toast (`// syncing · 12 deals found · upserting...`).

Both paths use the same server action so swapping is a config flip.

**Post-sync**: update `IntegrationStatus.lastSyncAt` + `metadata`. Dashboard pipeline number now "lives."

---

## Step 12 — Event Scraper *(~4–6h, the headline demo)*

**Why last**: highest wow, most moving parts. Reuses Target model from Step 5.

**Scope (per BUILD_PROMPT §10)**:
- New route `/scraper`:
  - URL input + `→ scrape` button + example pills (devcon, token2049, ethglobal, websummit, consensus).
  - Status bar with animated step messages (`fetching`, `parsing DOM`, `extracting`, `enriching`, `✓ extracted X speakers · Y sponsors`).
  - Two-panel result grid: speakers (checkbox rows w/ keynote/panel/workshop tag) + sponsors (checkbox rows w/ title/platinum/gold/silver/community tier tag).
  - Action bar: `X selected · event: [select] · priority: [select]` + `↓ CSV` + `+ add to target list` → creates `Target` rows.

**Implementation path**:
1. **Pre-loaded demo data** (MUST exist before any real scraping is wired): `src/lib/mock/scraped/{devcon,token2049,ethglobal,websummit,consensus}.json` with the counts specified in BUILD_PROMPT §10. The URL matcher routes keyword → file.
2. **Real scraper** (optional, behind feature flag): use the `anthropic-skills:bd-lead-gen-events` skill or a simple `fetch + cheerio` server action. For any URL that doesn't match a pre-loaded demo key, show `// scraper not available in demo build — try one of the examples below`.
3. Wire `+ add to target list` → existing `/api/targets` POST (bulk variant).

**Demo line**: "Paste a conference URL. Every speaker and sponsor in the target list — already enriched, already assigned."

---

## Step 13 — ROI + reporting polish *(~1h, optional closer)*

Pull everything together:
- Per-event ROI card: `pipeline / spent` ratio, visible on event detail.
- Dashboard `roi` stat card becomes real: `sum(pipeline) / sum(spent)`.
- `export_data` modal (from BUILD_PROMPT) → CSV of events, deals, targets, or a combined report. Use `papaparse` (add dep).

**Demo line**: "Token2049 cost $22k, generated $62k pipeline. That's a 2.8x ROI per conference."

---

## Suggested demo arc (15 min)

1. **Dashboard** (Step 2) — "six tools, one screen."
2. **Propose → Approve** (existing) — one-click approver flow.
3. **Event detail: budget + schedule + attendees** (Steps 1, 3, 6) — live spend, live roster.
4. **Invoice drop** (Step 8) — watch budget update.
5. **Pipeline kanban** (Step 7) — drag a card, stats move.
6. **Target list + Scraper** (Steps 5, 12) — paste `devcon.org/speakers` → instant BD list.
7. **Public page** (Step 9) — "and this is what the world sees."
8. **Integrations + HubSpot sync** (Steps 10, 11) — close on "don't replace tools, link them."

---

## Prompt template for the implementing LLM (use per step)

```
You are implementing Step N of EXTENSION_PLAN.md for the LI.Events platform
at /Users/alinazaprudska/coding/li.fi/vibe-a-thon.

Before you start:
1. Read EXTENSION_PLAN.md §Step N to scope the work.
2. Read prisma/schema.prisma and any page/API listed in the step.
3. Confirm existing patterns: db client location, Prisma migration command,
   how existing pages are structured.

Then:
4. Extend prisma/schema.prisma per the step. Run `pnpm prisma migrate dev
   --name step-N-<slug>`.
5. Add seed data to prisma/seed.ts that makes the feature look real in
   screenshots. Re-run `pnpm prisma db seed`.
6. Build API routes first, then pages/components. Server components unless
   interactivity requires "use client". Validate all inputs with zod.
7. Match the existing design system — do not invent new tokens, classes, or
   layouts. Reuse the tag colors, card styles, and modal pattern from
   BUILD_PROMPT.md.
8. Click through the new flow yourself, take a screenshot, and summarize
   what you verified.
9. Commit with message `feat: step N — <slug>`. Do not batch steps.

Constraints:
- No new deps unless the step explicitly requires one.
- No feature flags, no backward-compat shims — change the code in place.
- No empty states on the demo path; seed richly.
- If a step conflicts with existing code, stop and ask.
```
