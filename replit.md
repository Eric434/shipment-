# TeslaTrack

A Tesla-themed precision fleet logistics and package tracking platform. Users enter a tracking code to see real-time shipment location on a live map, a full event timeline, ETA, and can subscribe for email delivery alerts. Admins can create and manage tracking codes via a protected admin portal.

## Run & Operate

- `PORT=8080 pnpm --filter @workspace/api-server run dev` — run the API server on port 8080
- `PORT=20338 BASE_PATH=/ pnpm --filter @workspace/tracker run dev` — run the tracker frontend on port 20338
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: `DATABASE_URL` — Postgres connection string (auto-set by Replit DB)
- Optional env: `RESEND_API_KEY` — for email notifications (subscribe/deliver alerts)
- `ADMIN_PASSWORD` — set to `teslatrack-admin-2026` (in shared env vars)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui, Leaflet (maps), Framer Motion
- API: Express 5 + pg (direct SQL, no ORM)
- DB: PostgreSQL (Replit managed)
- Emails: Resend (optional — gracefully skipped if key not set)
- Build: esbuild (CJS bundle for API server)

## Where things live

- `artifacts/tracker/` — React frontend (landing page, tracking dashboard, admin portal)
- `artifacts/api-server/` — Express API server
- `artifacts/api-server/src/routes/` — API route handlers (packages, admin, notify, health)
- `artifacts/api-server/src/lib/db.ts` — pg Pool connection
- `attached_assets/` — Tesla car images used across the UI

## Architecture decisions

- API server uses raw `pg` Pool queries (no Drizzle ORM) for direct SQL control
- Resend client is lazily initialized so the server starts without `RESEND_API_KEY`
- Admin auth is simple token-based (`x-admin-token` header matches `ADMIN_PASSWORD`)
- Frontend proxies `/api` to `localhost:8080` via Vite dev server proxy
- Package route data stored as JSONB array of `{lat, lng}` waypoints

## Product

- **Landing page**: Search by tracking code, feature highlights, Tesla fleet imagery
- **Tracking dashboard**: Live Leaflet map with animated package position, event timeline, ETA, email subscription
- **Admin portal**: Create/edit/delete tracking codes, manage routes and event timelines

## Demo tracking codes

- `TSL-2026-001` — In Transit (Fremont CA → New York NY)
- `TSL-2026-002` — Out for Delivery (Austin TX → Miami FL)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Both `PORT` and `BASE_PATH` env vars must be set to start the tracker (Vite throws on startup otherwise)
- API server `PORT` must also be set explicitly in the run command
- Email features are silently skipped if `RESEND_API_KEY` is not configured

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
