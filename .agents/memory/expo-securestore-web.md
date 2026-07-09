---
name: Expo SecureStore web support
description: expo-secure-store throws on web ("getValueWithKeyAsync is not a function"); needs an AsyncStorage fallback for web builds.
---

`expo-secure-store` (`SecureStore.getItemAsync` / `setItemAsync`) has no functional web implementation in this Expo SDK — calling it on `Platform.OS === "web"` throws `ExpoSecureStore.default.getValueWithKeyAsync is not a function`, crashing the app on load.

**Why:** SecureStore relies on native keychain/keystore APIs that don't exist in a browser; the web shim isn't a real implementation.

**How to apply:** Any code path that must run on web (including Expo web preview) should branch on `Platform.OS === "web"` and use `@react-native-async-storage/async-storage` instead for that platform, keeping SecureStore for iOS/Android. Wrap both in a small `getPersistedX`/`setPersistedX` helper so call sites don't need to know about the platform branch.
