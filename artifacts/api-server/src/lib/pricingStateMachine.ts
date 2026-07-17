/**
 * 19 Sessions pricing state machine — pure logic module.
 *
 * New model (replaces the 12-level advance/regress system):
 * - Price is determined FRESH each month from the previous month's session count.
 * - No cycle counter, no reliability score, no gradual level progression.
 * - Lookup: sessionsCompletedMonth → level (0-10) → EUR price.
 * - Retrogression is implicit: any month with < 9 sessions resets to Level 0 (250 EUR).
 *
 * Level mapping (zero-based):
 *   Level 0: 250 EUR  — sessions ≤ 8
 *   Level 1: 139 EUR  — sessions = 9
 *   Level 2:  79 EUR  — sessions = 10
 *   Level 3:  47 EUR  — sessions = 11
 *   Level 4:  30 EUR  — sessions = 12
 *   Level 5:  21 EUR  — sessions = 13
 *   Level 6:  16 EUR  — sessions = 14
 *   Level 7:  13 EUR  — sessions = 15
 *   Level 8:  12 EUR  — sessions = 16
 *   Level 9:  11 EUR  — sessions = 17
 *   Level 10: 10 EUR  — sessions ≥ 18
 */

export const MIN_LEVEL = 0;
export const MAX_LEVEL = 10;
export const LEVEL_COUNT = MAX_LEVEL - MIN_LEVEL + 1;

/** Monthly price in EUR, indexed by zero-based level 0-10. */
export const PRICING_LEVELS_EUR: readonly number[] = [
  250, 139, 79, 47, 30, 21, 16, 13, 12, 11, 10,
];

export function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
}

export function priceForLevel(level: number): number {
  return PRICING_LEVELS_EUR[clampLevel(level)] as number;
}

/** User-facing label: level 0 → "1", level 10 → "11" */
export function displayLevel(level: number): number {
  return clampLevel(level) + 1;
}

/**
 * Maps a session count to the corresponding pricing level.
 * sessions ≤ 8 → Level 0 (250 EUR, full price)
 * sessions 9–17 → Levels 1–9 (exponential discount curve)
 * sessions ≥ 18 → Level 10 (floor: 10 EUR)
 */
export function sessionsToLevel(sessions: number): number {
  if (sessions <= 8) return 0;
  if (sessions >= 18) return MAX_LEVEL;
  // sessions 9-17 map to levels 1-9
  return sessions - 8;
}

export type MonthEvaluationInput = {
  sessionsCompletedMonth: number;
};

export type MonthEvaluationResult = {
  nextLevel: number;
};

/**
 * Evaluates a single completed calendar month for one user and returns the
 * next pricing level. Pure function — callers persist the result and sync to Stripe.
 */
export function evaluateMonth(input: MonthEvaluationInput): MonthEvaluationResult {
  return { nextLevel: sessionsToLevel(input.sessionsCompletedMonth) };
}

/** Returns the [start, end) UTC bounds of the previous full calendar month relative to `now`. */
export function previousCalendarMonthRange(now: Date): { start: Date; end: Date } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { start, end };
}
