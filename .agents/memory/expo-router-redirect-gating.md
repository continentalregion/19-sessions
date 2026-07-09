---
name: Expo Router root-layout redirect gating
description: How to correctly gate all routes behind a condition (e.g. onboarding) in an Expo Router root _layout.tsx.
---

When a root `app/_layout.tsx` needs to force-navigate to a screen (e.g. onboarding) before any other route is reachable, returning `<Redirect href="..." />` directly as the render output of the root layout component (in place of the `<Stack>`) results in a blank white screen with no console error, at least on web. The navigator/router state never gets a chance to mount properly.

**Why:** `<Redirect>` needs to run inside an already-mounted navigator context. The very first render of the root layout is that mounting step, so swapping the whole tree for a bare `<Redirect>` short-circuits it.

**How to apply:** Always render the full `<Stack>` (with all `Stack.Screen`s registered) unconditionally once fonts/providers are ready. Do the conditional navigation with `router.replace("/target")` inside a `useEffect` that runs when the gating condition becomes true, e.g.:

```tsx
useEffect(() => {
  if (isReady && !goal) {
    router.replace("/onboarding");
  }
}, [isReady, goal]);

if (!isReady) return null;

return (
  <Stack>
    <Stack.Screen name="onboarding" />
    <Stack.Screen name="(tabs)" />
  </Stack>
);
```
