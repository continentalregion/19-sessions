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
const MIN_4 = 240;
const MIN_3 = 180;

/**
 * Definizione definitiva dei 4 circuiti fissi — fonte di verità:
 * docs/architecture-plan.md sezione 3 ("Definizione definitiva dei 4
 * circuiti fissi"). Sequenza, esercizi, categorie e durate (workSeconds)
 * devono restare coerenti con quella tabella; non randomizzare né
 * riordinare. L'ultima voce di ogni circuito è sempre
 * riscaldamento/defaticamento (categoria balance_core, validazione pose
 * volutamente permissiva).
 */
export const CIRCUITS: Record<TrainingGoal, Circuit> = {
  // Circuito 1 — Muscle Tone, 35 min totali, più forza / meno cardio puro
  muscle_tone: {
    goal: "muscle_tone",
    exercises: [
      { id: "1", nameKey: "bosu_squat", category: "lower_strength", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "2", nameKey: "bosu_pushup", category: "upper_strength", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "3", nameKey: "bosu_lunge", category: "lower_strength", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "4", nameKey: "bosu_plank", category: "balance_core", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "5", nameKey: "bosu_glute_bridge", category: "lower_strength", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "6", nameKey: "bosu_pushup_rotation", category: "upper_strength", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "7", nameKey: "bosu_squat_jump", category: "lower_strength", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "8", nameKey: "bosu_side_plank", category: "balance_core", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "warmup", nameKey: "warmup_cooldown", category: "balance_core", workSeconds: MIN_4, restSeconds: 0 },
    ],
  },

  // Circuito 2 — Posture, 35 min totali, focus core/equilibrio/stabilizzazione
  posture: {
    goal: "posture",
    exercises: [
      { id: "1", nameKey: "bosu_bird_dog", category: "balance_core", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "2", nameKey: "bosu_plank_front", category: "balance_core", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "3", nameKey: "bosu_squat_isometric_reach", category: "lower_strength", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "4", nameKey: "bosu_balance", category: "balance_core", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "5", nameKey: "bosu_superman", category: "balance_core", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "6", nameKey: "bosu_wall_angel_squat", category: "lower_strength", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "7", nameKey: "bosu_side_plank_rotation", category: "balance_core", workSeconds: MIN_4, restSeconds: REST_DEFAULT },
      { id: "8", nameKey: "bosu_cat_cow", category: "balance_core", workSeconds: MIN_3, restSeconds: REST_DEFAULT },
      { id: "warmup", nameKey: "warmup_cooldown", category: "balance_core", workSeconds: MIN_4, restSeconds: 0 },
    ],
  },

  // Circuito 3 — Cardio General, 30–35 min totali, meno pause, intensità continua
  cardio_general: {
    goal: "cardio_general",
    exercises: [
      { id: "1", nameKey: "bosu_step_up", category: "cardio", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "2", nameKey: "bosu_mountain_climber", category: "cardio", workSeconds: MIN_3, restSeconds: REST_SHORT },
      { id: "3", nameKey: "bosu_squat_jump", category: "cardio", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "4", nameKey: "bosu_burpee", category: "cardio", workSeconds: MIN_3, restSeconds: REST_SHORT },
      { id: "5", nameKey: "bosu_lateral_lunge_dynamic", category: "cardio", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "6", nameKey: "bosu_plank_jack", category: "cardio", workSeconds: MIN_3, restSeconds: REST_SHORT },
      { id: "7", nameKey: "bosu_squat_press_overhead", category: "cardio", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "8", nameKey: "bosu_high_knees", category: "cardio", workSeconds: MIN_3, restSeconds: REST_SHORT },
      { id: "warmup", nameKey: "warmup_cooldown", category: "balance_core", workSeconds: MIN_3, restSeconds: 0 },
    ],
  },

  // Circuito 4 — Weight Loss, 40 min totali, mix forza+cardio, intensità più alta
  weight_loss: {
    goal: "weight_loss",
    exercises: [
      { id: "1", nameKey: "bosu_squat_jump", category: "cardio", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "2", nameKey: "bosu_pushup", category: "upper_strength", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "3", nameKey: "bosu_mountain_climber", category: "cardio", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "4", nameKey: "bosu_lunge_alternating_dynamic", category: "lower_strength", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "5", nameKey: "bosu_burpee", category: "cardio", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "6", nameKey: "bosu_plank_shoulder_tap", category: "balance_core", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "7", nameKey: "bosu_step_up", category: "cardio", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "8", nameKey: "bosu_glute_bridge_leg_extension", category: "lower_strength", workSeconds: MIN_4, restSeconds: REST_SHORT },
      { id: "warmup", nameKey: "warmup_cooldown", category: "balance_core", workSeconds: MIN_4, restSeconds: 0 },
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
