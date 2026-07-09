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

/**
 * Ritmo calibrato per utenti principianti (sostituisce i parametri più
 * aggressivi della prima bozza — vedi docs/architecture-plan.md sezione 3).
 *
 * Circuiti "standard" (muscle_tone, posture): lavoro 180s, pausa 30s,
 * riscaldamento/defaticamento 180s.
 * Totale: 8 x (180+30) + 180 = 1860s = 31 min.
 */
const WORK_STANDARD = 180;
const REST_STANDARD = 30;
const WARMUP_STANDARD = 180;

/**
 * Circuiti "cardio" (cardio_general, weight_loss): lavoro 170s, pausa 25s,
 * riscaldamento/defaticamento 240s (più lungo per compensare l'intensità).
 * Totale: 8 x (170+25) + 240 = 1800s = 30 min.
 */
const WORK_CARDIO = 170;
const REST_CARDIO = 25;
const WARMUP_CARDIO = 240;

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
  // Circuito 1 — Muscle Tone, ~31 min totali, più forza / meno cardio puro
  muscle_tone: {
    goal: "muscle_tone",
    exercises: [
      { id: "1", nameKey: "bosu_squat", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "2", nameKey: "bosu_pushup", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "3", nameKey: "bosu_lunge", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "4", nameKey: "bosu_plank", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "5", nameKey: "bosu_glute_bridge", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "6", nameKey: "bosu_pushup_rotation", category: "upper_strength", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "7", nameKey: "bosu_squat_jump", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "8", nameKey: "bosu_side_plank", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "warmup", nameKey: "warmup_cooldown", category: "balance_core", workSeconds: WARMUP_STANDARD, restSeconds: 0 },
    ],
  },

  // Circuito 2 — Posture, ~31 min totali, focus core/equilibrio/stabilizzazione
  posture: {
    goal: "posture",
    exercises: [
      { id: "1", nameKey: "bosu_bird_dog", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "2", nameKey: "bosu_plank_front", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "3", nameKey: "bosu_squat_isometric_reach", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "4", nameKey: "bosu_balance", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "5", nameKey: "bosu_superman", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "6", nameKey: "bosu_wall_angel_squat", category: "lower_strength", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "7", nameKey: "bosu_side_plank_rotation", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "8", nameKey: "bosu_cat_cow", category: "balance_core", workSeconds: WORK_STANDARD, restSeconds: REST_STANDARD },
      { id: "warmup", nameKey: "warmup_cooldown", category: "balance_core", workSeconds: WARMUP_STANDARD, restSeconds: 0 },
    ],
  },

  // Circuito 3 — Cardio General, ~30 min totali, meno pause, intensità continua
  cardio_general: {
    goal: "cardio_general",
    exercises: [
      { id: "1", nameKey: "bosu_step_up", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "2", nameKey: "bosu_mountain_climber", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "3", nameKey: "bosu_squat_jump", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "4", nameKey: "bosu_burpee", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "5", nameKey: "bosu_lateral_lunge_dynamic", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "6", nameKey: "bosu_plank_jack", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "7", nameKey: "bosu_squat_press_overhead", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "8", nameKey: "bosu_high_knees", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "warmup", nameKey: "warmup_cooldown", category: "balance_core", workSeconds: WARMUP_CARDIO, restSeconds: 0 },
    ],
  },

  // Circuito 4 — Weight Loss, ~30 min totali, mix forza+cardio, intensità più alta
  weight_loss: {
    goal: "weight_loss",
    exercises: [
      { id: "1", nameKey: "bosu_squat_jump", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "2", nameKey: "bosu_pushup", category: "upper_strength", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "3", nameKey: "bosu_mountain_climber", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "4", nameKey: "bosu_lunge_alternating_dynamic", category: "lower_strength", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "5", nameKey: "bosu_burpee", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "6", nameKey: "bosu_plank_shoulder_tap", category: "balance_core", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "7", nameKey: "bosu_step_up", category: "cardio", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "8", nameKey: "bosu_glute_bridge_leg_extension", category: "lower_strength", workSeconds: WORK_CARDIO, restSeconds: REST_CARDIO },
      { id: "warmup", nameKey: "warmup_cooldown", category: "balance_core", workSeconds: WARMUP_CARDIO, restSeconds: 0 },
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
