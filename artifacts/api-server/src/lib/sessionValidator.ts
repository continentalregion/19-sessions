/**
 * Server-side validation of a workout synced from HealthKit / Health Connect.
 * Pure logic: the caller supplies already-accepted sessions for overlap/daily
 * checks and persists the verdict.
 *
 * Nothing here trusts a client-supplied "isValid" flag: duration is recomputed
 * from start/end, and the verdict comes only from the raw health record.
 */

export type HealthSource = "healthkit" | "health_connect";

export type RawWorkout = {
  /** HealthKit sample UUID / Health Connect record id — unique per source. */
  externalId: string;
  source: HealthSource;
  /** Normalized activity type, see STRENGTH_TYPES / ACTIVITY_ALLOWLIST. */
  activityType: string;
  startAt: Date;
  endAt: Date;
  /** HKMetadataKeyWasUserEntered / Health Connect recordingMethod = manual. */
  userEntered: boolean;
  /** True if produced by a watch/ring/strap, not just the phone. */
  fromWearable: boolean;
  avgHeartRate?: number | null;
};

export const STRENGTH_TYPES: ReadonlySet<string> = new Set([
  "traditional_strength_training",
  "functional_strength_training",
  "core_training",
  "cross_training",
  "calisthenics",
]);

export const ACTIVITY_ALLOWLIST: ReadonlySet<string> = new Set([
  ...STRENGTH_TYPES,
  "hiit",
  "mixed_cardio",
  "running",
  "cycling",
  "swimming",
  "rowing",
  "elliptical",
  "stair_climbing",
  "boxing",
  "dance",
  "hiking",
  "jump_rope",
  "walking",
  "yoga",
  "pilates",
  "other",
]);

export type ValidatorConfig = {
  minDurationSeconds: number;
  minAvgHeartRate: number;
  maxAvgHeartRate: number;
  requireWearable: boolean;
  maxSessionsPerDay: number;
  /** Max time between workout end and server receipt. */
  maxSyncLagMs: number;
  /** Max accepted workout length (rejects absurd records). */
  maxDurationSeconds: number;
  /** IANA zone used to define "day" for the daily cap. */
  timeZone: string;
};

export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  minDurationSeconds: 25 * 60,
  minAvgHeartRate: 90,
  maxAvgHeartRate: 210,
  requireWearable: true,
  maxSessionsPerDay: 1,
  maxSyncLagMs: 7 * 24 * 3600 * 1000,
  maxDurationSeconds: 4 * 3600,
  timeZone: "Europe/Rome",
};

export type RejectReason =
  | "bad_time_range"
  | "future_dated"
  | "too_old"
  | "too_short"
  | "too_long"
  | "user_entered"
  | "not_from_wearable"
  | "activity_not_allowed"
  | "heart_rate_missing"
  | "heart_rate_too_low"
  | "heart_rate_implausible"
  | "overlaps_existing"
  | "daily_cap_reached"
  | "duplicate";

export type Verdict = { valid: boolean; reasons: RejectReason[] };

export type AcceptedSession = { externalId: string; source: HealthSource; startAt: Date; endAt: Date };

/** Calendar day key (YYYY-MM-DD) of an instant in the given IANA time zone. */
export function dayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function validateWorkout(
  w: RawWorkout,
  accepted: readonly AcceptedSession[],
  now: Date,
  overrides: Partial<ValidatorConfig> = {},
): Verdict {
  const cfg = { ...DEFAULT_VALIDATOR_CONFIG, ...overrides };
  const reasons: RejectReason[] = [];

  const startMs = w.startAt.getTime();
  const endMs = w.endAt.getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { valid: false, reasons: ["bad_time_range"] };
  }

  if (accepted.some((a) => a.source === w.source && a.externalId === w.externalId)) {
    return { valid: false, reasons: ["duplicate"] };
  }

  const durationSeconds = (endMs - startMs) / 1000;
  if (durationSeconds < cfg.minDurationSeconds) reasons.push("too_short");
  if (durationSeconds > cfg.maxDurationSeconds) reasons.push("too_long");

  // 5 min of clock-skew tolerance.
  if (endMs > now.getTime() + 5 * 60 * 1000) reasons.push("future_dated");
  if (now.getTime() - endMs > cfg.maxSyncLagMs) reasons.push("too_old");

  if (w.userEntered) reasons.push("user_entered");
  if (cfg.requireWearable && !w.fromWearable) reasons.push("not_from_wearable");
  if (!ACTIVITY_ALLOWLIST.has(w.activityType)) reasons.push("activity_not_allowed");

  const hr = w.avgHeartRate;
  if (hr == null) {
    if (cfg.requireWearable) reasons.push("heart_rate_missing");
  } else if (!(hr > 0) || hr > cfg.maxAvgHeartRate) {
    reasons.push("heart_rate_implausible");
  } else if (hr < cfg.minAvgHeartRate) {
    reasons.push("heart_rate_too_low");
  }

  if (accepted.some((a) => startMs < a.endAt.getTime() && endMs > a.startAt.getTime())) {
    reasons.push("overlaps_existing");
  }

  const key = dayKey(w.endAt, cfg.timeZone);
  const sameDay = accepted.filter((a) => dayKey(a.endAt, cfg.timeZone) === key).length;
  if (sameDay >= cfg.maxSessionsPerDay) reasons.push("daily_cap_reached");

  return { valid: reasons.length === 0, reasons };
}

/**
 * Validates a batch in chronological order so earlier workouts in the batch
 * count toward the overlap/daily-cap checks of later ones.
 */
export function validateBatch(
  batch: readonly RawWorkout[],
  accepted: readonly AcceptedSession[],
  now: Date,
  overrides: Partial<ValidatorConfig> = {},
): Array<{ workout: RawWorkout; verdict: Verdict }> {
  const sorted = [...batch].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const running: AcceptedSession[] = [...accepted];
  return sorted.map((workout) => {
    const verdict = validateWorkout(workout, running, now, overrides);
    if (verdict.valid) {
      running.push({
        externalId: workout.externalId,
        source: workout.source,
        startAt: workout.startAt,
        endAt: workout.endAt,
      });
    }
    return { workout, verdict };
  });
}
