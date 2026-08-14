# RTCOM OS

Desigo's in-house dairy operations platform — farm-to-delivery traceability,
CRM, offline delivery, billing, full double-entry accounting, and
hardware/IoT integration. See the original planning notes for full business
context; this file covers what's built and how to run it.

## Monorepo layout

```
apps/
  api/              Fastify backend — all business logic lives behind this
  web-erp/          Next.js — office control room (CRM, routes, billing, accounting)
  mobile-delivery/  Expo (SDK 54) — offline-first delivery rider app
  mobile-ops/       Expo (SDK 54) — farm/plant staff app, Hindi/English toggle
  iot-worker/       Standalone service: sweeps for offline hardware devices
packages/
  db/               Prisma schema + client (single source of truth for the data model)
  shared-types/     Zod schemas shared across api/web/mobile
  business-rules/   All deterministic money/date/quality logic — see below
  ui/               (reserved for shared RN components; not yet populated)
```

## Why business-rules is separate

Every rule that must never silently get it wrong — the 6:30 PM change
cutoff, subscription versioning, invoice math, double-entry ledger posting,
penalty calculation, container reconciliation — lives in
`packages/business-rules`, tested against a real Postgres database (not
mocked), independent of the API layer. The AI intent-parsing layer
(WhatsApp/voice) only ever *proposes* a change; this package is the one
place that can *apply* one, and every apply re-validates inputs regardless
of what produced them.

## First-time setup

1. **Postgres**: create a database and set `DATABASE_URL` in
   `packages/db/.env` and `apps/api/.env` (copy from the `.env.example`
   files in each). If you use Postgres.app on macOS, the default local user
   works with no password.
2. Install dependencies from the repo root:
   ```
   corepack pnpm install
   ```
   (or plain `pnpm install` if you have a `pnpm` shim on PATH — see "pnpm on
   PATH" below)
3. Migrate + generate the Prisma client:
   ```
   cd packages/db
   pnpm exec prisma migrate deploy
   pnpm exec prisma generate
   ```
4. Seed an admin user:
   ```
   cd apps/api
   pnpm run seed
   ```
   Defaults to phone `9999999999` / password `changeme123` — override via
   `SEED_ADMIN_PHONE`/`SEED_ADMIN_PASSWORD` env vars.
5. Seed the chart of accounts (once, via the API — see "Accounting" below).

### pnpm on PATH

This environment didn't have a global `pnpm` binary, only `corepack`. If
`pnpm` isn't found, either:
- always prefix commands with `corepack`, e.g. `corepack pnpm install`, or
- run once: `corepack enable --install-directory ~/.local/bin pnpm` and add
  `~/.local/bin` to your PATH.

## Running things

```
# Backend API (port 4000)
cd apps/api && pnpm dev

# Web ERP (port 3000) — needs apps/web-erp/.env.local with
# NEXT_PUBLIC_API_BASE_URL set (copy from .env.local.example)
cd apps/web-erp && pnpm dev

# Mobile apps — need the phone on the same WiFi as this machine, and
# app.json's extra.apiBaseUrl set to this machine's LAN IP (not localhost)
cd apps/mobile-delivery && pnpm start   # scan the QR with Expo Go
cd apps/mobile-ops && pnpm start

# IoT device-health worker (checks for offline hardware every 5 min)
cd apps/iot-worker && pnpm dev
```

Whole-workspace checks (from the repo root):
```
pnpm exec turbo run typecheck   # all packages
pnpm exec turbo run test        # business-rules integration/unit tests
```

## What's built

- **Auth/RBAC**: JWT access tokens + rotating opaque refresh tokens, roles
  (`ERP_ADMIN`, `PLANT_STAFF`, `FARM_STAFF`, `DELIVERY_BOY`).
- **CRM**: Lead intake (manual + auto-created from unrecognized WhatsApp
  numbers) → qualify → convert to Customer + Subscription.
- **WhatsApp/voice order-change automation**: inbound message → Claude
  parses intent → customer confirmation round-trip → deterministic apply.
  **Needs `ANTHROPIC_API_KEY`** in `apps/api/.env` to actually parse
  messages; the confirm/apply/cutoff-rejection pipeline works today without
  it (tested via a dev-only script that simulates a parsed intent).
- **Delivery**: route assignment, offline-first scan flow (QR scan, GPS,
  empty-container count, manual override for damaged QR, backup-rider
  handover), sync with idempotent replay.
- **Billing**: day-by-day invoice generation (quantity × rate, honoring
  subscription versions and per-date pause/extra exceptions), issue, record
  payment, flat penalties (lost bottle/barrel, AMC), daily unreturned-
  container penalty batch (`POST /billing/apply-daily-penalties` — trigger
  via cron once deployed).
- **Accounting**: full double-entry general ledger. Chart of accounts,
  balanced journal posting (invoices/payments post automatically), ledger
  view (a "cash book"/"bank book" is just this filtered to the Cash/Bank
  account), trial balance, P&L, balance sheet, manual expense recording.
- **Traceability**: farm milk entry → batch → plant receipt (auto-flags a
  farm/plant quality mismatch) → chiller blend (tracks % composition per
  farm) → bottling run (auto-flags a manual-vs-camera count mismatch) →
  containers.
- **Hardware/IoT**: device registration issues an API key; devices POST
  readings to a webhook authenticated by that key (not MQTT — no broker
  infrastructure exists yet, see below); temperature readings outside a
  safe range are flagged on ingestion; `iot-worker` marks a device OFFLINE
  if it goes quiet for 10 minutes.
- **Public trace page**: `/trace/:qrCode` on the web app, no login — a
  customer scanning their bottle's QR sees its farm origin and quality
  checks.

## Known gaps / deliberately deferred

These were explicit, reasoned scope decisions, not oversights:

- **Real pricing/billing data**: `Subscription.ratePerLitre` defaults to 0.
  The user (Desigo) will provide real client/billing/location/variant data
  to import — the schema and billing engine are ready for it.
- **MQTT for IoT devices**: the plan originally specified MQTT with an HTTP
  fallback; HTTP webhooks became primary since no MQTT broker is deployed.
  Revisit if/when that infrastructure exists.
- **Device-to-chiller linkage**: `Device.location` is free text, not a
  formal relation — the public trace page's temperature trail is
  intentionally left empty rather than fuzzy-matched, since a wrong reading
  on a customer-facing trust feature is worse than a missing one.
- **Voice/IVR channel**: `CustomerMessage.channel` supports `VOICE_CALL` and
  the intent pipeline is channel-agnostic, but no telephony provider
  (Exotel/Twilio) integration has been wired up yet.
- **Route optimization**: `RouteStop.sequenceOptimized` exists in the
  schema but nothing populates it yet — sequencing is still manual.
- **Expected-containers-per-stop**: the delivery manifest doesn't
  pre-populate which specific container QRs are expected at a stop (that
  depends on a bottling→delivery allocation step not yet built); the sync
  endpoint validates whatever QR is actually scanned against real Container
  rows instead.
- **Mobile apps are untested on a physical device/Expo Go** — verified via
  `expo export` (bundles cleanly for iOS and Android) and full workspace
  typecheck, but not click-tested on hardware.
- **Predictive chiller alerts / delay prediction**: named in the original
  notes as later-phase items; not detailed enough to build without more
  real operating data.
