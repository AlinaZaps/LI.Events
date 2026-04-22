# vibe-a-thon — Event Platform MVP

Internal event-management platform for li.finance's workspace manager. See [PLAN.md](./PLAN.md) for the product spec and [BUILD_PROMPT.md](./BUILD_PROMPT.md) for the build playbook.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind v4
- shadcn/ui components (base preset)
- Prisma 7 + local Postgres 16 (brew)
- pnpm
- Secrets via 1Password (item: **"Hackathon - LI.Events (HiBob)"**)

## Prerequisites
```
brew install postgresql@16 node pnpm
brew install --cask 1password-cli   # optional, for `op run`
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

# 3. Wire secrets
cp .env.example .env.local
# Then either:
#   A. Paste HiBob creds from 1Password → .env.local
#   B. Leave the op:// refs in place and run the dev server under `op run`

# 4. Run migrations + seed (seed runs automatically on `migrate dev`)
pnpm prisma migrate dev

# 5. Start the dev server
pnpm dev                                       # regular
op run --env-file=.env.local -- pnpm dev       # 1Password CLI flow
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
| `pnpm lint` | ESLint |
| `pnpm prisma migrate dev` | Apply migrations + run seed |
| `pnpm prisma studio` | Browse the DB |

## Secrets — never commit
- `.env.local` is git-ignored; `.env.example` is the template.
- The HiBob service user ID and API token live in 1Password (**"Hackathon - LI.Events (HiBob)"** — username + password fields). They must never land in `.env.example`, logs, or client bundles.
