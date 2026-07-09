import type { ScattoResult } from "./types";
import { SESSION_MIN_VALID_CHECKPOINT_RATIO } from "./checkpointSchedule";

export type VerificationTier = "verified_base" | "verified_enhanced";

export interface AccelerometerCoherenceSummary {
  sampleCount: number;
  coherentSampleCount: number;
}

export interface SessionValidationSummary {
  camScattiValid: number;
  camScattiInvalid: number;
  accelerometerCoherenceRatio: number;
  isValid: boolean;
  /** 1.0 for verified_base, 1.5 for verified_enhanced (wearable HR bonus). */
  reliabilityScore: number;
  verificationTier: VerificationTier;
}

/**
 * Aggregates camera "scatti" + accelerometer results collected during a
 * session into the structured summary sent to the backend (no video, no
 * images — see docs/architecture-plan.md section 4).
 *
 * `wearableHrConfirmed` is left false/undefined until phase 2 (wearable
 * integration) is implemented; it upgrades the tier to verified_enhanced.
 */
export function buildSessionValidationSummary(
  scatti: ScattoResult[],
  accel: AccelerometerCoherenceSummary,
  wearableHrConfirmed = false,
): SessionValidationSummary {
  const camScattiValid = scatti.filter((s) => s.valid).length;
  const camScattiInvalid = scatti.length - camScattiValid;

  const accelerometerCoherenceRatio =
    accel.sampleCount > 0 ? accel.coherentSampleCount / accel.sampleCount : 0;

  const scattiRatio = scatti.length > 0 ? camScattiValid / scatti.length : 0;
  const isValid =
    scattiRatio >= SESSION_MIN_VALID_CHECKPOINT_RATIO &&
    accelerometerCoherenceRatio >= SESSION_MIN_VALID_CHECKPOINT_RATIO;

  const verificationTier: VerificationTier = wearableHrConfirmed
    ? "verified_enhanced"
    : "verified_base";
  const reliabilityScore = verificationTier === "verified_enhanced" ? 1.5 : 1.0;

  return {
    camScattiValid,
    camScattiInvalid,
    accelerometerCoherenceRatio,
    isValid,
    reliabilityScore,
    verificationTier,
  };
}
