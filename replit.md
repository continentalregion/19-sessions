# 19 Sessions BOSU

Fitness mobile app (Expo/React Native) built around a fixed 19-workout BOSU circuit system, Health Connect (Android) + HealthKit (iOS) session validation, and a Stripe-billed direct session-count→price lookup that adjusts the monthly subscription based on consistency. Owned by TRANTADS LTD.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/mobile run dev` — run the Expo app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push-force` — push DB schema changes (dev only, use push-force to skip TTY prompts)
- `pnpm --filter @workspace/scripts run seed-pricing-products` — idempotently create the Stripe product + 11 monthly EUR prices (levels 0–10) tagged with `metadata.level`
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
- Session validation: `react-native-health-connect` (Android) + `react-native-health` (iOS)

## Where things live

- `artifacts/api-server/src/lib/pricingStateMachine.ts` — pure pricing logic: `sessionsToLevel(n)` direct lookup, 11 levels (0–10), no cycle counter
- `artifacts/api-server/src/lib/stripeClient.ts` — Stripe client + StripeSync init (webhook handling, `stripe.*` schema sync)
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — Clerk proxy middleware (mounted before body parsers/cors)
- `artifacts/api-server/src/routes/pricing.ts` — pricing state, checkout, portal (all `requireAuth()`-gated), and monthly cycle-all endpoints
- `artifacts/api-server/src/routes/sessions.ts` — `POST /api/sessions`: saves completed workout session for authenticated user
- `scripts/src/seed-pricing-products.ts` — one-off/idempotent Stripe product & price seeding (11 prices, levels 0–10)
- `artifacts/mobile/app/(auth)/sign-in.tsx`, `sign-up.tsx` — custom Clerk auth screens (Core v3 SDK: email/password + Google SSO)
- `artifacts/mobile/app/_layout.tsx` — `ClerkProvider`/`ClerkLoaded` wrapper, auth gate (`useAuth().isSignedIn`), wires `setAuthTokenGetter`
- `artifacts/mobile/context/AppContext.tsx` — device-generated `userId` (UUID, SecureStore/AsyncStorage) — **local/analytics identifier only**, not used for pricing/Stripe calls
- `artifacts/mobile/app/(tabs)/settings.tsx` — subscription section (level, price, status, subscribe/manage actions)
- `artifacts/mobile/app/session.tsx` — session timer, Health Connect/HealthKit validation on completion, saves via `POST /api/sessions`
- `artifacts/mobile/lib/health.ts` — platform abstraction for health validation (web/Expo Go fallback)
- `artifacts/mobile/lib/health.android.ts` — Health Connect (Android) workout query (≥15 min threshold)
- `artifacts/mobile/lib/health.ios.ts` — HealthKit (iOS) workout query (≥15 min threshold via `getAnchoredWorkouts`)
- `docs/architecture-plan.md` — full product/pricing spec (Italian) and implementation status log

## Architecture decisions

- **Pricing is now a direct session-count→price lookup, not a 12-level advance/regress machine.** 11 levels (0–10), each month evaluated independently from session count. No cycle counter. Price table: ≤8 sessions→€250, 9→€139, 10→€79, 11→€47, 12→€30, 13→€21, 14→€16, 15→€13, 16→€12, 17→€11, ≥18→€10. Level 0 = full price (€250), Level 10 = floor (€10). `displayLevel = currentLevel + 1` (1–11 for UI).
- **Session validation is Health Connect (Android) / HealthKit (iOS), not camera+accelerometer.** Camera, pose estimation, and accelerometer code fully removed. `artifacts/mobile/lib/health.android.ts` + `health.ios.ts` are picked up by React Native's platform-specific bundler. The `isValid` flag is set client-side from health data (workout found in session window, duration ≥ 15 min) and trusted server-side on save.
- **Authentication is Clerk (real login), not the device UUID.** All `/api/pricing/*` and `/api/sessions` routes derive `userId` from `getAuth(req).userId` — never from a client-supplied path param or body. The device UUID in `AppContext` remains only as a local/analytics identifier. Mobile uses custom Clerk Core v3 SDK screens with email/password + Google SSO.
- `stripe-replit-sync` must be excluded from the esbuild bundle (`external` list in `artifacts/api-server/build.mjs`) — it resolves its own `migrations/` directory relative to its `__dirname` at runtime.
- Monthly pricing cycle evaluation runs via `POST /api/pricing/cycle-all`, gated by `x-cron-secret`. Evaluates previous calendar month valid session count → sets new price via direct lookup → syncs to Stripe subscription.
- `@clerk/shared/keys` sub-path is not resolvable in `@clerk/shared@4.25.0` — `app.ts` passes `publishableKey: process.env["CLERK_PUBLISHABLE_KEY"]` directly to `clerkMiddleware` instead.

## Product

- Fixed 4-circuit BOSU workout system tailored to a user's selected training goal (muscle_tone/posture/cardio_general/weight_loss), each session timed with audio cues.
- Subscription price starts at €250/mo and steps down (to €10/mo at level 10) based on monthly valid session count, tracked via a stateless lookup table and billed through Stripe Checkout/Customer Portal.

## User preferences

- Follow the dev order: Expo+EAS → Drizzle schema → Health Connect/HealthKit validation → 4 fixed BOSU circuits → pricing state machine + Stripe → onboarding → wearable integration (phase 2).
- No subagents/testing monitors — implement directly.
- Push to GitHub (`continentalregion/19-sessions`, public) after every completed step.
- User reviews each step closely and expects exact, working code plus documentation updates.

## Gotchas

- After changing anything Stripe-related in `artifacts/api-server`, restart the workflow and re-check logs — a broken migration path fails silently (server still starts, but `stripe.*` tables and webhook sync stay empty).
- Stripe price `search` (used to resolve `metadata.level` → price ID) has an indexing delay of up to ~30s after creating a price — checkout right after seeding prices may 400 briefly.
- `drizzle-kit push` requires a TTY for column-drop confirmations — use `push-force` script or apply SQL directly via `executeSql` in code_execution.
- Health Connect / HealthKit require a native EAS dev build — unavailable in Expo Go. `lib/health.ts` provides a fallback that returns `isValid: false` for web/Expo Go.
- `trainingGoalEnum` in DB is `["muscle_tone","posture","cardio_general","weight_loss"]` — must stay in sync with `CreateWorkoutSessionBody` in openapi.yaml and circuits.ts `TrainingGoal` type.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `stripe` skill for Stripe integration conventions on Replit
