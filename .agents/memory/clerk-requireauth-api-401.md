---
name: Clerk requireAuth() dev handshake redirect breaks APIs
description: Why @clerk/express's requireAuth() middleware is wrong for JSON API routes and what to use instead.
---

`requireAuth()` from `@clerk/express`, when mounted directly on a route, responds to a missing or invalid token in a development Clerk instance with a 302 "handshake" redirect (`X-Clerk-Auth-Reason: dev-browser-missing` / `token-invalid`) instead of a 401. This happens for both GET and POST, and even with a garbage `Authorization: Bearer` header present — it is not limited to browser navigation requests.

**Why:** The handshake redirect exists to let same-origin browser clients sync a dev-instance session cookie. It has no business intercepting API/mobile clients that authenticate via averified Bearer token and expect a JSON response, but `requireAuth()` doesn't distinguish the two by default.

**How to apply:** For pure JSON API routes (mobile clients, fetch-based SPA calls, etc.), don't use `requireAuth()` as middleware. Instead check `getAuth(req)` manually and return `res.status(401).json(...)` yourself:

```ts
const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
};
```

This matches the clerk-auth skill's own documented pattern for protecting Express API routes.
