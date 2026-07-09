export type TrainingGoal =
  | "muscle_tone"
  | "posture"
  | "cardio_general"
  | "weight_loss";

export type ExerciseCategory =
  | "balance_core"
  | "lower_strength"
  | "upper_strength"
  | "cardio";

export interface CircuitExercise {
  id: string;
  nameKey: string;
  category: ExerciseCategory;
  workSeconds: number;
  restSeconds: number;
}

export interface Circuit {
  goal: TrainingGoal;
  exercises: CircuitExercise[];
}

const REST_DEFAULT = 20;
const REST_SHORT = 10;
const WORK_STANDARD = 210; // 3.5 min

export const CIRCUITS: Record<TrainingGoal, Circuit> = {
  muscle_tone: {
    goal: "muscle_tone",
    exercises: [
      { id: "1", nameKey: "bosu_squat", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "2", nameKey: "bosu_pushup", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "3", nameKey: "bosu_lunge", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "4", nameKey: "bosu_plank", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "5", nameKey: "bosu_glute_bridge", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "6", nameKey: "bosu_balance", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "7", nameKey: "bosu_pushup", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "8", nameKey: "bosu_squat", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "9", nameKey: "bosu_bird_dog", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: 0 },
    ],
  },
  posture: {
    goal: "posture",
    exercises: [
      { id: "1", nameKey: "bosu_balance", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "2", nameKey: "bosu_bird_dog", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "3", nameKey: "bosu_plank", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "4", nameKey: "bosu_squat", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "5", nameKey: "bosu_russian_twist", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "6", nameKey: "bosu_glute_bridge", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "7", nameKey: "bosu_balance", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "8", nameKey: "bosu_bird_dog", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_DEFAULT },
      { id: "9", nameKey: "bosu_plank", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: 0 },
    ],
  },
  cardio_general: {
    goal: "cardio_general",
    exercises: [
      { id: "1", nameKey: "bosu_high_knees", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "2", nameKey: "bosu_mountain_climber", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "3", nameKey: "bosu_burpee", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "4", nameKey: "bosu_side_step", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "5", nameKey: "bosu_squat", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "6", nameKey: "bosu_high_knees", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "7", nameKey: "bosu_mountain_climber", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "8", nameKey: "bosu_burpee", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "9", nameKey: "bosu_plank", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: 0 },
    ],
  },
  weight_loss: {
    goal: "weight_loss",
    exercises: [
      { id: "1", nameKey: "bosu_burpee", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "2", nameKey: "bosu_squat", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "3", nameKey: "bosu_pushup", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "4", nameKey: "bosu_mountain_climber", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "5", nameKey: "bosu_lunge", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "6", nameKey: "bosu_high_knees", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "7", nameKey: "bosu_plank", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "8", nameKey: "bosu_glute_bridge", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_SHORT },
      { id: "9", nameKey: "bosu_burpee", category: "cardio", workSeconds: WORK_STANDARD, restSeconds: 0 },
    ],
  },
};

export function getCircuitTotalMinutes(circuit: Circuit): number {
  const totalSeconds = circuit.exercises.reduce(
    (sum, ex) => sum + ex.workSeconds + ex.restSeconds,
    0,
  );
  return Math.round(totalSeconds / 60);
}

export function getCircuitCategories(circuit: Circuit): ExerciseCategory[] {
  const seen = new Set<ExerciseCategory>();
  for (const ex of circuit.exercises) seen.add(ex.category);
  return Array.from(seen);
}
