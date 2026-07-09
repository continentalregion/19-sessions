import type { ExerciseCategory } from "@/constants/circuits";
import type { PoseKeypoints, ScattoResult } from "./types";
import {
  averageScore,
  hasMinimumVisibility,
  jointAngle,
} from "./keypoints";

export interface ValidatorContext {
  exerciseId: string;
  category: ExerciseCategory;
  checkpointLabel: string;
  timestampMs: number;
}

export type CategoryValidator = (
  pose: PoseKeypoints,
  ctx: ValidatorContext,
) => ScattoResult;

function baseResult(ctx: ValidatorContext, valid: boolean, confidence: number, reason?: string): ScattoResult {
  return {
    exerciseId: ctx.exerciseId,
    checkpointLabel: ctx.checkpointLabel,
    valid,
    confidence,
    reason,
    timestampMs: ctx.timestampMs,
  };
}

/**
 * lower_strength (squat / lunge / glute bridge on BOSU): validate a deep knee
 * bend at the checkpoint — knee angle should be meaningfully flexed relative
 * to standing (180deg straight leg).
 */
const validateLowerStrength: CategoryValidator = (pose, ctx) => {
  if (!hasMinimumVisibility(pose)) {
    return baseResult(ctx, false, 0, "pose_not_visible");
  }
  const leftKnee = jointAngle(pose, "leftHip", "leftKnee", "leftAnkle");
  const rightKnee = jointAngle(pose, "rightHip", "rightKnee", "rightAnkle");
  const knee = [leftKnee, rightKnee].filter((a): a is number => a !== null);
  if (knee.length === 0) {
    return baseResult(ctx, false, 0, "knees_not_visible");
  }
  const bestKnee = Math.min(...knee);
  // Deep bend: <130deg. Standing straight is ~170-180deg.
  const valid = bestKnee < 130;
  const confidence = averageScore(pose, ["leftHip", "leftKnee", "leftAnkle", "rightHip", "rightKnee", "rightAnkle"]);
  return baseResult(ctx, valid, confidence, valid ? undefined : "insufficient_knee_flexion");
};

/**
 * upper_strength (push-up on BOSU): validate a lowered chest position —
 * elbow angle should be meaningfully flexed at the bottom of the rep.
 */
const validateUpperStrength: CategoryValidator = (pose, ctx) => {
  if (!hasMinimumVisibility(pose)) {
    return baseResult(ctx, false, 0, "pose_not_visible");
  }
  const leftElbow = jointAngle(pose, "leftShoulder", "leftElbow", "leftWrist");
  const rightElbow = jointAngle(pose, "rightShoulder", "rightElbow", "rightWrist");
  const elbow = [leftElbow, rightElbow].filter((a): a is number => a !== null);
  if (elbow.length === 0) {
    return baseResult(ctx, false, 0, "elbows_not_visible");
  }
  const bestElbow = Math.min(...elbow);
  const valid = bestElbow < 140;
  const confidence = averageScore(pose, ["leftShoulder", "leftElbow", "leftWrist", "rightShoulder", "rightElbow", "rightWrist"]);
  return baseResult(ctx, valid, confidence, valid ? undefined : "insufficient_elbow_flexion");
};

/**
 * balance_core (plank / bird-dog / single-leg stand on BOSU): validate a
 * straight hip-shoulder-ankle line (plank posture) or, when a leg/arm is
 * visibly lifted, an asymmetric stance consistent with a balance hold.
 */
const validateBalanceCore: CategoryValidator = (pose, ctx) => {
  if (!hasMinimumVisibility(pose)) {
    return baseResult(ctx, false, 0, "pose_not_visible");
  }
  const leftHipLine = jointAngle(pose, "leftShoulder", "leftHip", "leftAnkle");
  const rightHipLine = jointAngle(pose, "rightShoulder", "rightHip", "rightAnkle");
  const hipLine = [leftHipLine, rightHipLine].filter((a): a is number => a !== null);
  const confidence = averageScore(pose, ["leftShoulder", "leftHip", "leftAnkle", "rightShoulder", "rightHip", "rightAnkle"]);
  if (hipLine.length === 0) {
    return baseResult(ctx, false, 0, "hip_line_not_visible");
  }
  const straightest = Math.max(...hipLine);
  // Plank/hold posture: body line close to straight (>150deg).
  const valid = straightest > 150;
  return baseResult(ctx, valid, confidence, valid ? undefined : "body_line_not_straight");
};

/**
 * cardio (high knees / mountain climber / burpee on BOSU): validate active
 * limb movement by checking a knee is meaningfully raised above hip-adjacent
 * resting height at the checkpoint instant.
 */
const validateCardio: CategoryValidator = (pose, ctx) => {
  if (!hasMinimumVisibility(pose)) {
    return baseResult(ctx, false, 0, "pose_not_visible");
  }
  const leftKnee = jointAngle(pose, "leftHip", "leftKnee", "leftAnkle");
  const rightKnee = jointAngle(pose, "rightHip", "rightKnee", "rightAnkle");
  const knee = [leftKnee, rightKnee].filter((a): a is number => a !== null);
  const confidence = averageScore(pose, ["leftHip", "leftKnee", "leftAnkle", "rightHip", "rightKnee", "rightAnkle"]);
  if (knee.length === 0) {
    return baseResult(ctx, false, 0, "knees_not_visible");
  }
  // Cardio checkpoints look for a driven knee (sharp flexion) similar to
  // lower_strength but with a slightly looser threshold since motion blur
  // reduces landmark precision during fast movement.
  const bestKnee = Math.min(...knee);
  const valid = bestKnee < 145;
  return baseResult(ctx, valid, confidence, valid ? undefined : "insufficient_drive");
};

export const CATEGORY_VALIDATORS: Record<ExerciseCategory, CategoryValidator> = {
  lower_strength: validateLowerStrength,
  upper_strength: validateUpperStrength,
  balance_core: validateBalanceCore,
  cardio: validateCardio,
};

export function validatePoseForExercise(
  pose: PoseKeypoints,
  ctx: ValidatorContext,
): ScattoResult {
  return CATEGORY_VALIDATORS[ctx.category](pose, ctx);
}
