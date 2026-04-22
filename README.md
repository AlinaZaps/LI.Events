# LI.Events

> The internal event platform for li.finance — from budget request to sign-off in two clicks.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Postgres](https://img.shields.io/badge/Postgres-16-316192?logo=postgresql&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)

---

## Why it exists

Planning a conference, side-event, or BD dinner at li.finance used to mean a trail of Slack threads, spreadsheets, and forwarded email approvals — with the workspace manager stitching it all together by hand. **LI.Events collapses that into a single workflow**: create the event, pick an approver from HiBob, send a signed approval link, track budget vs. actuals, done.

No approver login. No shared docs. No lost threads. Just a URL, a click, and an audit trail.

## What's inside

- **One-click approval flow** — approvers act via a signed `/approve/[token]` URL, no account required. Every decision is logged.
- **Budget that breathes** — set a budget, log spend as it happens, see at a glance which events are over/under. Categorised by conference, side-event, hackathon, BD dinner, or sponsorship.
- **HiBob as the source of truth** — approvers and notify recipients pulled live from HiBob employees + departments. No stale user lists to maintain.
- **Email that knows its environment** — `log` mode for local dev (prints to console), `resend` mode for production. Swap with one env var.
- **A full audit log** — every state transition on every event, queryable from the event page.
- **Tested where it matters** — the approval flow (the part you can't afford to get wrong) is covered by a Vitest integration test against a real Postgres.

## Stack

- **Next.js 15** (App Router, Server Actions, Turbopack) on TypeScript
- **Prisma 6** + **Postgres 16**
- **Tailwind v4** + **Base UI** (`@base-ui/react`) with shadcn-style wrappers in `src/components/ui/`
- **Resend** for transactional email
- **Vitest** for integration tests
- **pnpm** for package management

## Quickstart

```bash
# One-time
brew install postgresql@16 node pnpm
brew services start postgresql@16

# Clone + install
git clone git@github.com:AlinaZaps/LI.Events.git
cd LI.Events
pnpm install

# Database
psql postgres -c "CREATE USER postgres SUPERUSER LOGIN PASSWORD 'postgres';"
psql postgres -c "CREATE DATABASE vibe_a_ton OWNER postgres;"
cp .env.example .env.local   # fill in HiBob + Resend creds
pnpm prisma migrate dev      # migrations + seed

# Run
pnpm dev
```

Open http://localhost:3333 and you're in.

> Postgres 16 is keg-only on Homebrew. To get `psql` on your PATH outside this project:
> ```
> export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
> ```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server (turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (approval-flow integration test) |
| `pnpm prisma migrate dev` | Apply migrations + re-seed |
| `pnpm prisma migrate reset` | Drop everything and rebuild from scratch |
| `pnpm prisma studio` | Visual DB browser |

## Environment

All keys live in `.env.local` (git-ignored). See [`.env.example`](./.env.example) for the template.

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `HIBOB_SERVICE_USER_ID`, `HIBOB_API_TOKEN` | HiBob service account credentials |
| `EMAIL_MODE` | `log` (dev, prints to console) or `resend` (production) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Required when `EMAIL_MODE=resend` |
| `APP_BASE_URL` | Base URL used to build approval links (e.g. `http://localhost:3333`) |

## Project layout

```
src/
  app/
    events/          # manager-facing pages (list, detail, new, archived)
    approve/[token]/ # public approval page — no auth, token-gated
    api/hibob/       # HiBob proxy routes (employees, departments)
  components/ui/     # Base UI-backed primitives
  lib/               # db client, email dispatch, HiBob client, spend calc
prisma/
  schema.prisma      # User / Event / AuditLog / ApprovedAttendee etc.
  migrations/
  seed.ts
tests/
  approval-flow.test.ts   # real-Postgres integration test
```

## Security notes

- `.env.local` is git-ignored; `.env.example` is the committed template.
- HiBob credentials must never land in `.env.example`, server logs, or client bundles.
- Approval tokens are 256-bit random strings (base64url-encoded, generated with `crypto.randomBytes`), unique per event.

## Roadmap

See [`EXTENSION_PLAN.md`](./EXTENSION_PLAN.md) for the ordered feature backlog (easiest → hardest, each step shippable on its own).
