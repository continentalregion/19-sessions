---
name: Expo dev-client + placeholder EAS projectId blocks CI preview
description: Why the Expo workflow hangs on a "Log in / Proceed anonymously" prompt after adding expo-dev-client/EAS config
---

Adding `expo-dev-client` to an Expo app that previously ran fine in Expo Go inside Replit's preview can make `expo start` hang on an interactive "It is recommended to log in... unverified-app-expo-go" prompt, even though the app has no real EAS account linked yet.

**Why:** the prompt is triggered by `app.json` having `extra.eas.projectId` set (even to a placeholder value) while there's no real EAS login/token — the CLI tries to verify the project and falls back to an interactive choice. Setting `CI=1` does NOT fix this; it just turns the same block into a hard `CommandError: Input is required... non-interactive mode`.

**How to apply:** while EAS isn't actually configured yet (no `eas login` / `EXPO_TOKEN`), do not set `extra.eas.projectId` in `app.json`. Add `expo-dev-client` + `eas.json` + native permission config for future EAS builds, but force `expo start --go` in the dev script so the Replit preview still opens in Expo Go and skips the dev-client account check. Only add the real `projectId` once the user has actually run `eas init`/`eas login` with their own account outside Replit.
