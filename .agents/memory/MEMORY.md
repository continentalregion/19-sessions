# Memory Index

- [Expo Router root-layout redirect gating](expo-router-redirect-gating.md) — bare `<Redirect>` returned from root `_layout.tsx` renders a blank white screen; use `router.replace` in a `useEffect` instead.
- [Expo SecureStore web support](expo-securestore-web.md) — `expo-secure-store` has no web implementation; fall back to AsyncStorage when `Platform.OS === "web"`.
- [Expo dev-client + placeholder EAS projectId blocks CI preview](expo-eas-devclient-login-prompt.md) — don't set `extra.eas.projectId` until real `eas login`/`init` is done; use `expo start --go` to keep Replit preview on Expo Go.
