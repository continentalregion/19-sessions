import type { Keypoint, PoseKeypoints } from "./types";

/**
 * MoveNet Lightning COCO keypoint indices.
 * https://www.tensorflow.org/hub/tutorials/movenet
 */
export const KEYPOINT_INDEX = {
  nose: 0,
  leftEye: 1,
  rightEye: 2,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
} as const;

export type KeypointName = keyof typeof KEYPOINT_INDEX;

export const MIN_KEYPOINT_SCORE = 0.3;

export function getKeypoint(pose: PoseKeypoints, name: KeypointName): Keypoint | null {
  const kp = pose[KEYPOINT_INDEX[name]];
  if (!kp || kp.score < MIN_KEYPOINT_SCORE) return null;
  return kp;
}

/** Angle in degrees at vertex `b`, formed by rays b->a and b->c. */
export function angleBetween(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const abX = a.x - b.x;
  const abY = a.y - b.y;
  const cbX = c.x - b.x;
  const cbY = c.y - b.y;

  const dot = abX * cbX + abY * cbY;
  const magAB = Math.sqrt(abX * abX + abY * abY);
  const magCB = Math.sqrt(cbX * cbX + cbY * cbY);
  if (magAB === 0 || magCB === 0) return 0;

  const cos = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function jointAngle(
  pose: PoseKeypoints,
  a: KeypointName,
  vertex: KeypointName,
  c: KeypointName,
): number | null {
  const pa = getKeypoint(pose, a);
  const pv = getKeypoint(pose, vertex);
  const pc = getKeypoint(pose, c);
  if (!pa || !pv || !pc) return null;
  return angleBetween(pa, pv, pc);
}

/** Average confidence across the keypoints that matter for a given check. */
export function averageScore(pose: PoseKeypoints, names: KeypointName[]): number {
  const scores = names
    .map((n) => pose[KEYPOINT_INDEX[n]]?.score ?? 0)
    .filter((s) => s >= 0);
  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/** Whether enough of the body is visible in frame to attempt validation at all. */
export function hasMinimumVisibility(pose: PoseKeypoints): boolean {
  const core: KeypointName[] = [
    "leftShoulder",
    "rightShoulder",
    "leftHip",
    "rightHip",
  ];
  return core.every((n) => getKeypoint(pose, n) !== null);
}
