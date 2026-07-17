---
name: clerk-shared-keys-missing
description: @clerk/shared/keys sub-path missing in v4.25.0 — how to fix publishableKey in app.ts
---

## Rule
Do not import from `@clerk/shared/keys`. The sub-path export does not exist in `@clerk/shared@4.25.0`.

**Why:** The `publishableKeyFromHost` function was used to derive the Clerk publishable key from the request host (for multi-domain scenarios). In practice this project is mono-tenant, so the env var value is the correct key for all requests.

**How to apply:** In `app.ts`, pass `publishableKey` directly from env:

```ts
app.use(
  clerkMiddleware({
    publishableKey: process.env["CLERK_PUBLISHABLE_KEY"],
  }),
);
```

If `@clerk/shared` is upgraded and re-exports the sub-path, verify the function signature before re-introducing it.
