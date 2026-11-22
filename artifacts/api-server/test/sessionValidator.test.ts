import { test } from "node:test";
import assert from "node:assert/strict";
import { validateWorkout, validateBatch, type RawWorkout } from "../src/lib/sessionValidator.ts";

const now = new Date("2026-12-01T12:00:00Z");
const mk = (over: Partial<RawWorkout> = {}): RawWorkout => ({
  externalId: "w1",
  source: "healthkit",
  activityType: "traditional_strength_training",
  startAt: new Date("2026-11-30T17:00:00Z"),
  endAt: new Date("2026-11-30T17:30:00Z"),
  userEntered: false,
  fromWearable: true,
  avgHeartRate: 120,
  ...over,
});

test("a normal 30-min watch workout is valid", () => {
  assert.deepEqual(validateWorkout(mk(), [], now), { valid: true, reasons: [] });
});

test("24:59 is too short, 25:00 is enough", () => {
  const short = mk({ endAt: new Date("2026-11-30T17:24:59Z") });
  assert.deepEqual(validateWorkout(short, [], now).reasons, ["too_short"]);
  const ok = mk({ endAt: new Date("2026-11-30T17:25:00Z") });
  assert.equal(validateWorkout(ok, [], now).valid, true);
});

test("manual entries and phone-only records are rejected", () => {
  assert.ok(validateWorkout(mk({ userEntered: true }), [], now).reasons.includes("user_entered"));
  assert.ok(validateWorkout(mk({ fromWearable: false }), [], now).reasons.includes("not_from_wearable"));
});

test("heart rate: missing, too low, implausible", () => {
  assert.ok(validateWorkout(mk({ avgHeartRate: null }), [], now).reasons.includes("heart_rate_missing"));
  assert.ok(validateWorkout(mk({ avgHeartRate: 70 }), [], now).reasons.includes("heart_rate_too_low"));
  assert.ok(validateWorkout(mk({ avgHeartRate: 260 }), [], now).reasons.includes("heart_rate_implausible"));
});

test("unknown activity and bad/future/old dates are rejected", () => {
  assert.ok(validateWorkout(mk({ activityType: "video_game" }), [], now).reasons.includes("activity_not_allowed"));
  assert.deepEqual(validateWorkout(mk({ endAt: new Date("2026-11-30T16:00:00Z") }), [], now).reasons, ["bad_time_range"]);
  const future = mk({ startAt: new Date("2026-12-02T10:00:00Z"), endAt: new Date("2026-12-02T10:30:00Z") });
  assert.ok(validateWorkout(future, [], now).reasons.includes("future_dated"));
  const old = mk({ startAt: new Date("2026-11-01T10:00:00Z"), endAt: new Date("2026-11-01T10:30:00Z") });
  assert.ok(validateWorkout(old, [], now).reasons.includes("too_old"));
});

test("duplicate externalId is rejected once", () => {
  const acc = [{ externalId: "w1", source: "healthkit" as const, startAt: new Date("2026-11-30T17:00:00Z"), endAt: new Date("2026-11-30T17:30:00Z") }];
  assert.deepEqual(validateWorkout(mk(), acc, now).reasons, ["duplicate"]);
});

test("overlapping workout from another device and the 1/day cap", () => {
  const acc = [{ externalId: "a", source: "healthkit" as const, startAt: new Date("2026-11-30T17:10:00Z"), endAt: new Date("2026-11-30T17:40:00Z") }];
  const r = validateWorkout(mk({ externalId: "b" }), acc, now).reasons;
  assert.ok(r.includes("overlaps_existing") && r.includes("daily_cap_reached"));
  // different day is fine
  const next = mk({ externalId: "c", startAt: new Date("2026-11-29T17:00:00Z"), endAt: new Date("2026-11-29T17:30:00Z") });
  assert.equal(validateWorkout(next, acc, now).valid, true);
});

test("daily cap uses the local timezone day, not UTC", () => {
  // 23:10 and 00:10 Rome time (UTC+1 in Nov) are different local days though 1h apart
  const acc = [{ externalId: "a", source: "healthkit" as const, startAt: new Date("2026-11-29T21:40:00Z"), endAt: new Date("2026-11-29T22:10:00Z") }];
  const w = mk({ externalId: "b", startAt: new Date("2026-11-29T23:15:00Z"), endAt: new Date("2026-11-29T23:45:00Z") });
  assert.equal(validateWorkout(w, acc, now).valid, true);
});

test("batch: first of two same-day workouts wins, order independent of input order", () => {
  const first = mk({ externalId: "a" });
  const second = mk({ externalId: "b", startAt: new Date("2026-11-30T19:00:00Z"), endAt: new Date("2026-11-30T19:30:00Z") });
  const res = validateBatch([second, first], [], now);
  assert.equal(res[0]!.workout.externalId, "a");
  assert.equal(res[0]!.verdict.valid, true);
  assert.deepEqual(res[1]!.verdict.reasons, ["daily_cap_reached"]);
});
