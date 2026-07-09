---
name: stripe-replit-sync must be externalized from esbuild bundle
description: Bundling stripe-replit-sync into a single esbuild output silently breaks its migration runner (no error, no tables created).
---

`stripe-replit-sync`'s `runMigrations()` resolves its SQL migrations directory via `path.resolve(__dirname, "./migrations")` relative to its own package location. If esbuild bundles the package into a single-file output (e.g. an Express server's `dist/index.mjs`), `__dirname` at runtime points to the app's own dist folder instead of the package's `dist/migrations`, so migrations silently apply zero files — no thrown error, no log warning distinguishable from success.

Symptom: server boots fine, `StripeSync initialized` logs normally, but querying any `stripe.*` table (e.g. `stripe.accounts`) fails with "relation does not exist", and webhook/account sync methods throw at runtime instead of at startup.

**Why:** esbuild's bundling rewrites `__dirname` semantics for anything pulled into the bundle; libraries that do path-relative filesystem access (config files, migrations, templates) at runtime are unsafe to bundle even though they have no native/binary dependencies.

**How to apply:** any package doing `path.resolve(__dirname, ...)` for runtime file access (not just native modules) should be added to the esbuild `external` list. For this repo, `stripe-replit-sync` is in `artifacts/api-server/build.mjs`'s `external` array — check it's still there if Stripe sync starts failing after a build config change.
