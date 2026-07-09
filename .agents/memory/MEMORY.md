# Memory Index

- [Expo Router root-layout redirect gating](expo-router-redirect-gating.md) — bare `<Redirect>` returned from root `_layout.tsx` renders a blank white screen; use `router.replace` in a `useEffect` instead.
- [Expo SecureStore web support](expo-securestore-web.md) — `expo-secure-store` has no web implementation; fall back to AsyncStorage when `Platform.OS === "web"`.
- [Expo dev-client + placeholder EAS projectId blocks CI preview](expo-eas-devclient-login-prompt.md) — don't set `extra.eas.projectId` until real `eas login`/`init` is done; use `expo start --go` to keep Replit preview on Expo Go.
- [Vision Camera frame processors](expo-vision-camera-frame-processors.md) — v5 dropped useFrameProcessor API; pin to v4.x for fast-tflite/resize-plugin pipelines.
- [stripe-replit-sync bundling](stripe-replit-sync-bundling.md) — must be esbuild `external`; bundling silently breaks its migration runner (no error, no tables).
- [Clerk requireAuth() dev handshake redirect breaks APIs](clerk-requireauth-api-401.md) — @clerk/express requireAuth() 302-redirects on missing/invalid token in dev; use manual getAuth(req) check for JSON APIs.
