import type { ScattoResult } from "./types";

export type VerificationTier = "verified_base" | "verified_enhanced";

export interface AccelerometerCoherenceSummary {
  sampleCount: number;
  coherentSampleCount: number;
}

/** Weighted validity score weights when a wearable is connected. */
const WEIGHT_CAMERA_WITH_WEARABLE = 0.5;
const WEIGHT_ACCEL_WITH_WEARABLE = 0.35;
const WEIGHT_WEARABLE = 0.15;

/**
 * Weights when no wearable is connected: the 0.15 wearable weight is
 * redistributed proportionally across camera/accelerometer so no weight is
 * lost from the denominator (0.50 / (0.50+0.35) = 0.5882.., 0.35 / 0.85 =
 * 0.4117..; rounded per product spec to 0.59 / 0.41).
 */
const WEIGHT_CAMERA_NO_WEARABLE = 0.59;
const WEIGHT_ACCEL_NO_WEARABLE = 0.41;

/** Minimum weighted validity score for a session to count as completed. */
export const SESSION_MIN_VALID_SCORE = 0.7;

export interface SessionValidationSummary {
  camScattiValid: number;
  camScattiInvalid: number;
  accelerometerCoherenceRatio: number;
  /** Weighted composite score (0-1) — see buildSessionValidationSummary. */
  validationScore: number;
  isValid: boolean;
  /** 1.0 for verified_base, 1.5 for verified_enhanced (wearable HR bonus). */
  reliabilityScore: number;
  verificationTier: VerificationTier;
}

/**
 * Aggregates camera "scatti" + accelerometer results (+ optional wearable
 * HR confirmation) collected during a session into the structured summary
 * sent to the backend (no video, no images — see
 * docs/architecture-plan.md section 4).
 *
 * Validity is a weighted composite score, NOT a binary AND of thresholds:
 *   score = 0.50 * scattiRatio + 0.35 * accelerometerCoherenceRatio
 *         + 0.15 * wearableScore   (only when a wearable is connected)
 * When no wearable is connected, the 0.15 is redistributed proportionally
 * so camera/accelerometer weigh 0.59 / 0.41 instead of 0.50 / 0.35.
 * Session is valid when score >= SESSION_MIN_VALID_SCORE (0.70).
 *
 * `wearableConnected` / `wearableHrConfirmed` stay false until phase 2
 * (wearable integration) is implemented — until then every session uses
 * the redistributed 0.59/0.41 camera+accelerometer-only weighting.
 *
 * The `reliabilityScore`/`verificationTier` bonus used by the pricing
 * state machine is a fully separate calculation (unaffected by this
 * validity score) and is left unchanged.
 */
export function buildSessionValidationSummary(
  scatti: ScattoResult[],
  accel: AccelerometerCoherenceSummary,
  wearableConnected = false,
  wearableHrConfirmed = false,
): SessionValidationSummary {
  const camScattiValid = scatti.filter((s) => s.valid).length;
  const camScattiInvalid = scatti.length - camScattiValid;

  const accelerometerCoherenceRatio =
    accel.sampleCount > 0 ? accel.coherentSampleCount / accel.sampleCount : 0;

  const scattiRatio = scatti.length > 0 ? camScattiValid / scatti.length : 0;

  let validationScore: number;
  if (wearableConnected) {
    const wearableScore = wearableHrConfirmed ? 1 : 0;
    validationScore =
      WEIGHT_CAMERA_WITH_WEARABLE * scattiRatio +
      WEIGHT_ACCEL_WITH_WEARABLE * accelerometerCoherenceRatio +
      WEIGHT_WEARABLE * wearableScore;
  } else {
    validationScore =
      WEIGHT_CAMERA_NO_WEARABLE * scattiRatio +
      WEIGHT_ACCEL_NO_WEARABLE * accelerometerCoherenceRatio;
  }

  const isValid = validationScore >= SESSION_MIN_VALID_SCORE;

  const verificationTier: VerificationTier =
    wearableConnected && wearableHrConfirmed ? "verified_enhanced" : "verified_base";
  const reliabilityScore = verificationTier === "verified_enhanced" ? 1.5 : 1.0;

  return {
    camScattiValid,
    camScattiInvalid,
    accelerometerCoherenceRatio,
    validationScore,
    isValid,
    reliabilityScore,
    verificationTier,
  };
}
