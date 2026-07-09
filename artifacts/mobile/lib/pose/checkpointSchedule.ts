import type { CircuitExercise } from "@/constants/circuits";

export interface Checkpoint {
  /** Seconds elapsed since the exercise's work phase started. */
  atWorkSecond: number;
  label: string;
}

/**
 * "Scatti" (camera checkpoints) per exercise: the camera briefly validates
 * pose only at these instants rather than continuously, per the hybrid
 * verification design in docs/architecture-plan.md section 4.
 *
 * Placement: skip the first/last ~15% of the work phase (transition noise)
 * and sample 3 evenly spaced instants in between.
 */
export function getCheckpointsForExercise(exercise: CircuitExercise): Checkpoint[] {
  const work = exercise.workSeconds;
  if (work <= 0) return [];

  const margin = Math.max(5, Math.round(work * 0.15));
  const usableSpan = Math.max(0, work - margin * 2);
  if (usableSpan <= 0) {
    return [{ atWorkSecond: Math.floor(work / 2), label: "mid" }];
  }

  const fractions: { frac: number; label: string }[] = [
    { frac: 0.2, label: "early" },
    { frac: 0.5, label: "mid" },
    { frac: 0.8, label: "late" },
  ];

  return fractions.map(({ frac, label }) => ({
    atWorkSecond: Math.round(margin + usableSpan * frac),
    label,
  }));
}

/** Minimum fraction of checkpoints across the whole session that must be
 * valid for the session to count as a completed 19-Session workout. */
export const SESSION_MIN_VALID_CHECKPOINT_RATIO = 0.7;
