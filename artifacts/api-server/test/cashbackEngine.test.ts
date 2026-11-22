import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSchedule,
  addMonthsUTC,
  closedMonths,
  contractMonthWindow,
  evaluateMonth,
  installmentOutcome,
} from "../src/lib/cashbackEngine.ts";

test("1000 EUR: 100 commission, 900 pool, 12 x 75", () => {
  const s = buildSchedule(100_000);
  assert.equal(s.commissionCents, 10_000);
  assert.equal(s.poolCents, 90_000);
  assert.deepEqual(s.installmentCents, Array(12).fill(7_500));
});

test("installments always sum exactly to the pool (remainder cents)", () => {
  for (const fee of [2999, 100_001, 99_999, 12_345, 1]) {
    const s = buildSchedule(fee);
    assert.equal(s.installmentCents.reduce((a, b) => a + b, 0), s.poolCents);
    assert.equal(s.commissionCents + s.poolCents, fee);
    assert.ok(Math.max(...s.installmentCents) - Math.min(...s.installmentCents) <= 1);
  }
});

test("29.99 EUR annual fee splits without losing cents", () => {
  const s = buildSchedule(2999);
  assert.equal(s.commissionCents, 300);
  assert.equal(s.poolCents, 2699);
  assert.equal(s.installmentCents[0], 225);
  assert.equal(s.installmentCents[11], 224);
});

test("invalid inputs throw", () => {
  assert.throws(() => buildSchedule(0));
  assert.throws(() => buildSchedule(10.5));
  assert.throws(() => buildSchedule(1000, { commissionBps: 10001 }));
});

test("addMonthsUTC clamps month-end days", () => {
  assert.equal(addMonthsUTC(new Date("2026-01-31T10:00:00Z"), 1).toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(addMonthsUTC(new Date("2028-01-31T10:00:00Z"), 1).toISOString(), "2028-02-29T10:00:00.000Z");
  assert.equal(addMonthsUTC(new Date("2026-11-15T00:00:00Z"), 3).toISOString(), "2027-02-15T00:00:00.000Z");
});

test("month windows are contiguous, anchored on contract start", () => {
  const start = new Date("2026-11-22T08:00:00Z");
  const a = contractMonthWindow(start, 1);
  const b = contractMonthWindow(start, 2);
  assert.equal(a.start.toISOString(), start.toISOString());
  assert.equal(a.end.getTime(), b.start.getTime());
  assert.equal(contractMonthWindow(start, 12).end.toISOString(), "2027-11-22T08:00:00.000Z");
});

test("closedMonths only returns fully elapsed months, max 12", () => {
  const start = new Date("2026-01-10T00:00:00Z");
  assert.equal(closedMonths(start, new Date("2026-02-09T23:59:59Z")).length, 0);
  assert.equal(closedMonths(start, new Date("2026-02-10T00:00:00Z")).length, 1);
  assert.equal(closedMonths(start, new Date("2026-06-11T00:00:00Z")).length, 5);
  assert.equal(closedMonths(start, new Date("2030-01-01T00:00:00Z")).length, 12);
});

test("19 sessions pays, 18 forfeits", () => {
  const mk = (n: number) => Array.from({ length: n }, () => ({ isStrength: false }));
  assert.equal(installmentOutcome(evaluateMonth(mk(19))), "paid");
  assert.equal(installmentOutcome(evaluateMonth(mk(25))), "paid");
  assert.equal(installmentOutcome(evaluateMonth(mk(18))), "forfeited");
  assert.equal(installmentOutcome(evaluateMonth(mk(0))), "forfeited");
});

test("optional strength minimum gates the installment", () => {
  const sessions = [
    ...Array.from({ length: 7 }, () => ({ isStrength: true })),
    ...Array.from({ length: 12 }, () => ({ isStrength: false })),
  ];
  assert.equal(evaluateMonth(sessions, { minStrengthSessions: 8 }).qualifies, false);
  assert.equal(evaluateMonth(sessions, { minStrengthSessions: 7 }).qualifies, true);
  assert.equal(evaluateMonth(sessions).qualifies, true);
});
