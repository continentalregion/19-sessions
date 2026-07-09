/**
 * MoveNet Lightning (17-keypoint COCO layout) types shared across the pose
 * estimation pipeline. See lib/pose/keypoints.ts for indices and geometry helpers.
 */

export interface Keypoint {
  x: number; // normalized 0-1, relative to input frame width
  y: number; // normalized 0-1, relative to input frame height
  score: number; // confidence 0-1
}

/** Raw model output: 17 keypoints in COCO order. */
export type PoseKeypoints = Keypoint[];

export interface PoseFrameResult {
  keypoints: PoseKeypoints;
  timestampMs: number;
}

/** Result of validating a single "scatto" (checkpoint) against an exercise. */
export interface ScattoResult {
  exerciseId: string;
  checkpointLabel: string;
  valid: boolean;
  confidence: number;
  reason?: string;
  timestampMs: number;
}
