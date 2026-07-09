# 19 Sessions

Fitness mobile app (Expo/React Native) built around a fixed 19-workout circuit system, camera-based pose estimation for form scoring, and a Stripe-billed pricing state machine that adjusts the monthly subscription price based on consistency. Owned by TRANTADS LTD.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/mobile run dev` — run the Expo app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-pricing-products` — idempotently create the Stripe product + 12 monthly EUR prices (levels 0–11) tagged with `metadata.level`
- Required env: `DATABASE_URL` — Postgres connection string; `CRON_SECRET` — shared secret for `POST /api/pricing/cycle-all`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)
- Mobile: Expo + EAS, expo-router, react-i18next (it/en/es/zh)
- Payments: Stripe via the Replit Stripe connector + `stripe-replit-sync`

## Where things live

- `artifacts/api-server/src/lib/pricingStateMachine.ts` — pure pricing level logic (12 levels, advance/regress/reset rules)
- `artifacts/api-server/src/lib/stripeClient.ts` — Stripe client + StripeSync init (webhook handling, `stripe.*` schema sync)
- `artifacts/api-server/src/lib/clerkProxyMiddleware.ts` — Clerk proxy middleware (mounted before body parsers/cors)
- `artifacts/api-server/src/routes/pricing.ts` — pricing state, checkout, portal (all `requireAuth()`-gated), and monthly cycle-all endpoints
- `scripts/src/seed-pricing-products.ts` — one-off/idempotent Stripe product & price seeding
- `artifacts/mobile/app/(auth)/sign-in.tsx`, `sign-up.tsx` — custom Clerk auth screens (Core v3 SDK: email/password + Google SSO)
- `artifacts/mobile/app/_layout.tsx` — `ClerkProvider`/`ClerkLoaded` wrapper, auth gate (`useAuth().isSignedIn`), wires `setAuthTokenGetter`
- `artifacts/mobile/context/AppContext.tsx` — device-generated `userId` (UUID, SecureStore/AsyncStorage) — **local/analytics identifier only**, not used for pricing/Stripe calls
- `artifacts/mobile/app/(tabs)/settings.tsx` — subscription section (level, price, status, subscribe/manage actions)
- `docs/architecture-plan.md` — full product/pricing spec (Italian) and implementation status log

## Architecture decisions

- Pricing levels are 0-indexed in data/logic (`currentLevel` 0–11) and mapped to 1–12 for user-facing display (`displayLevel`) — keeps DB/state-machine code zero-based while matching the user-facing "Level 1–12" copy.
- **Authentication is Clerk (real login), not the device UUID.** All `/api/pricing/*` routes (state/checkout/portal) derive `userId` from `getAuth(req).userId` after `requireAuth()` — never from a client-supplied path param or body. This fixed an IDOR where any client could read/mutate another user's pricing state or open Checkout/Portal for them by supplying their UUID. The device UUID in `AppContext` remains only as a local/analytics identifier. Mobile uses custom Clerk Core v3 SDK screens (native `<SignIn/>`/`<SignUp/>` components don't work in Expo Go) with email/password + Google SSO; the session token is attached to API calls via `setAuthTokenGetter`.
- `stripe-replit-sync` must be excluded from the esbuild bundle (`external` list in `artifacts/api-server/build.mjs`) — it resolves its own `migrations/` directory relative to its `__dirname` at runtime, which breaks silently when bundled into a single output file.
- Monthly pricing cycle evaluation runs via `POST /api/pricing/cycle-all`, gated by an `x-cron-secret` header matched against `CRON_SECRET` — intended to be triggered by an external scheduler. Not client-callable, so it wasn't part of the IDOR fix.

## Product

- Fixed 4-circuit workout system tailored to a user's selected training goal (tone/posture/cardio/weight loss), guided by camera-based pose estimation and accelerometer-based reliability scoring.
- Subscription price starts at €139/mo and steps down (to €41/mo at level 12) based on monthly consistency, tracked via a 12-level state machine and billed through Stripe Checkout/Customer Portal.

## User preferences

- Follow the dev order: Expo+EAS → Drizzle schema → camera/pose estimation → 4 fixed circuits → accelerometer scoring → pricing state machine + Stripe → onboarding → wearable integration (phase 2).
- No subagents/testing monitors — implement directly.
- Push to GitHub (`continentalregion/19-sessions`, public) after every completed step.
- User reviews each step closely and expects exact, working code plus documentation updates.

## Gotchas

- After changing anything Stripe-related in `artifacts/api-server`, restart the workflow and re-check logs — a broken migration path fails silently (server still starts, but `stripe.*` tables and webhook sync stay empty).
- Stripe price `search` (used to resolve `metadata.level` → price ID) has an indexing delay of up to ~30s after creating a price — checkout right after seeding prices may 400 briefly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `stripe` skill for Stripe integration conventions on Replit
