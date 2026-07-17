export type HealthSource = "health_connect" | "healthkit" | null;

export interface HealthCheckResult {
  isValid: boolean;
  healthSource: HealthSource;
}

/**
 * Web / Expo Go fallback — health APIs are unavailable outside a native build.
 * Always returns isValid: false so the session is saved as unvalidated.
 */
export async function checkWorkoutValidity(
  _startedAt: Date,
  _minDurationMs: number,
): Promise<HealthCheckResult> {
  return { isValid: false, healthSource: null };
}
