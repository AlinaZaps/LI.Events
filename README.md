# LI.Events — Event Platform MVP

Internal event-management platform for li.finance's workspace manager. Create events, route them through a token-based approval flow, track budget vs. spend, and sync approvers/attendees from HiBob.

## Features
- **Event lifecycle** — draft → sent for approval → completed; archive when done.
- **Token-based approval** — approvers act via a signed `/approve/[token]` URL; no login for them.
- **Budget tracking** — budget + spend per event, categorised (conference / side-event / hackathon / BD dinner / sponsorship).
- **HiBob integration** — pull employees + departments as the source of truth for approvers and notify recipients.
- **Email dispatch** — `log` mode for dev, `resend` mode for real sends.
- **Audit log** — every state transition recorded per event.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind v4
- [Base UI](https://base-ui.com/) components (`@base-ui/react`) with shadcn-style wrappers in `src/components/ui/`
- Prisma 6 + local Postgres 16 (brew)
- Vitest for the approval-flow integration test
- pnpm

## Prerequisites
```
brew install postgresql@16 node pnpm
brew services start postgresql@16
```

Postgres 16 is keg-only on Homebrew; if you want `psql` on your PATH outside of this project, add it to your shell rc:
```
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
```

## Setup
```bash
# 1. Install deps
pnpm install

# 2. Create the local database (one-time, if not already created)
createdb -h localhost -U postgres vibe_a_ton   # or see "DB bootstrap" below

# 3. Wire secrets — paste HiBob creds into .env.local
cp .env.example .env.local

# 4. Run migrations + seed (seed runs automatically on `migrate dev`)
pnpm prisma migrate dev

# 5. Start the dev server
pnpm dev
```

Open http://localhost:3000.

## DB bootstrap (one-time)
Homebrew's `postgresql@16` creates a superuser matching your macOS username, not `postgres`. The commands below create the `postgres` role + the `vibe_a_ton` database referenced in `.env.example`:
```bash
psql postgres -c "CREATE USER postgres SUPERUSER LOGIN PASSWORD 'postgres';"
psql postgres -c "CREATE DATABASE vibe_a_ton OWNER postgres;"
```

Reset the database at any time:
```bash
pnpm prisma migrate reset   # drops + re-runs migrations + seed
```

## Scripts
| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server (turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest run (approval-flow integration test) |
| `pnpm prisma migrate dev` | Apply migrations + run seed |
| `pnpm prisma studio` | Browse the DB |

## Environment variables
See [.env.example](./.env.example). Required keys:
- `DATABASE_URL` — local Postgres connection string
- `HIBOB_SERVICE_USER_ID`, `HIBOB_API_TOKEN` — HiBob service account
- `EMAIL_MODE` — `log` (dev) or `resend`
- `RESEND_API_KEY`, `EMAIL_FROM` — only when `EMAIL_MODE=resend`
- `APP_BASE_URL` — base URL used to build approval links

## Secrets — never commit
- `.env.local` is git-ignored; `.env.example` is the template.
- The HiBob service user ID and API token must never land in `.env.example`, logs, or client bundles.
