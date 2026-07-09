import { setBaseUrl } from "@workspace/api-client-react";

// The API server artifact is mounted at the `/api` path behind the shared
// Replit proxy. In development we talk to it via the same domain Expo is
// served from; in production builds it's the app's own deployed domain.
const domain = process.env["EXPO_PUBLIC_DOMAIN"];

export function configureApiBaseUrl(): void {
  if (!domain) return;
  setBaseUrl(`https://${domain}`);
}
