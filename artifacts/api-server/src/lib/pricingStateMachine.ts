/**
 * 19 Sessions pricing state machine — pure logic module.
 *
 * Source of truth for the level/pricing rules: docs/architecture-plan.md §5-7.
 *
 * - 12 levels, zero-based (0-11) in data/logic. UI shows "Livello 1-12" (level + 1).
 * - PRICING_LEVELS_EUR[level] is the monthly EUR price for that level.
 * - Evaluation runs once per completed calendar month, per user:
 *   - Advance 2 levels if sessionsCompleted >= 19 AND avgReliabilityScore >= 1.4
 *   - Advance 1 level if sessionsCompleted >= 19 but avgReliabilityScore < 1.4
 *   - Retreat 1 level (floor 0) if sessionsCompleted < 19
 *   - cycleMonthCounter increments each evaluated month; at the 13th month
 *     (cycleMonthCounter reaching 12) the cycle resets: currentLevel -> 0,
 *     cycleMonthCounter -> 0, subscriptionStartedAt -> now.
 * - No deposits, no negative refunds — Stripe only ever bills the current
 *   level's monthly price going forward.
 */

export const MIN_LEVEL = 0;
export const MAX_LEVEL = 11;
export const LEVEL_COUNT = MAX_LEVEL - MIN_LEVEL + 1;
export const CYCLE_MONTHS = 12;

export const MIN_SESSIONS_FOR_ADVANCE = 19;
export const MIN_RELIABILITY_FOR_DOUBLE_ADVANCE = 1.4;

/** Monthly price in EUR, indexed by zero-based level 0-11. */
export const PRICING_LEVELS_EUR: readonly number[] = [
  139, 130, 121, 112, 103, 94, 86, 77, 68, 59, 50, 41,
];

export function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
}

export function priceForLevel(level: number): number {
  return PRICING_LEVELS_EUR[clampLevel(level)] as number;
}

export function displayLevel(level: number): number {
  return clampLevel(level) + 1;
}

export type MonthEvaluationInput = {
  currentLevel: number;
  cycleMonthCounter: number;
  sessionsCompletedMonth: number;
  avgReliabilityScoreMonth: number | null;
};

export type MonthTransition =
  | "advanced_double"
  | "advanced_single"
  | "regressed"
  | "reset";

export type MonthEvaluationResult = {
  transition: MonthTransition;
  nextLevel: number;
  nextCycleMonthCounter: number;
  cycleReset: boolean;
};

/**
 * Evaluates a single completed calendar month for one user and returns the
 * next pricing state. Does not mutate input; callers persist the result and
 * decide whether/how to sync it to Stripe.
 */
export function evaluateMonth(input: MonthEvaluationInput): MonthEvaluationResult {
  const { currentLevel, cycleMonthCounter, sessionsCompletedMonth, avgReliabilityScoreMonth } =
    input;

  const qualifies = sessionsCompletedMonth >= MIN_SESSIONS_FOR_ADVANCE;
  const bonusQualifies =
    qualifies &&
    avgReliabilityScoreMonth != null &&
    avgReliabilityScoreMonth >= MIN_RELIABILITY_FOR_DOUBLE_ADVANCE;

  let transition: MonthTransition;
  let nextLevel: number;

  if (bonusQualifies) {
    transition = "advanced_double";
    nextLevel = clampLevel(currentLevel - 2);
  } else if (qualifies) {
    transition = "advanced_single";
    nextLevel = clampLevel(currentLevel - 1);
  } else {
    transition = "regressed";
    nextLevel = clampLevel(currentLevel + 1);
  }

  const nextCounter = cycleMonthCounter + 1;

  // 13th month of the subscription cycle: reset to level 0, restart the cycle.
  if (nextCounter >= CYCLE_MONTHS) {
    return {
      transition: "reset",
      nextLevel: MIN_LEVEL,
      nextCycleMonthCounter: 0,
      cycleReset: true,
    };
  }

  return {
    transition,
    nextLevel,
    nextCycleMonthCounter: nextCounter,
    cycleReset: false,
  };
}

/** Returns the [start, end) UTC bounds of the previous full calendar month relative to `now`. */
export function previousCalendarMonthRange(now: Date): { start: Date; end: Date } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { start, end };
}
