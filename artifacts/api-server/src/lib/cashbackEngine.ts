/**
 * Annual-fee + conditional monthly cashback — pure logic (no I/O).
 *
 * Model (Nov 2026 pivot):
 *  - The user pays an annual fee upfront (e.g. 1000 EUR).
 *  - The platform keeps a commission (default 10%).
 *  - The remaining pool (90%) is split in 12 monthly installments.
 *  - Each contract month, the installment is paid out only if the user logged
 *    at least `requiredSessions` valid sessions in that month (default 19).
 *  - An unmet month is "forfeited". What happens to forfeited money is a
 *    product/legal decision and is intentionally NOT encoded here.
 *
 * All money is integer cents. Months are anniversary-based (contract start),
 * computed in UTC, so a contract starting on the 15th has months 15th→15th.
 */

export const DEFAULT_COMMISSION_BPS = 1000; // 10.00%
export const DEFAULT_INSTALLMENTS = 12;
export const DEFAULT_REQUIRED_SESSIONS = 19;

export type CashbackConfig = {
  commissionBps: number;
  installments: number;
  requiredSessions: number;
  /** Optional: at least this many of the qualifying sessions must be strength training. 0 = off. */
  minStrengthSessions: number;
};

export const DEFAULT_CONFIG: CashbackConfig = {
  commissionBps: DEFAULT_COMMISSION_BPS,
  installments: DEFAULT_INSTALLMENTS,
  requiredSessions: DEFAULT_REQUIRED_SESSIONS,
  minStrengthSessions: 0,
};

export type CashbackSchedule = {
  feeCents: number;
  commissionCents: number;
  poolCents: number;
  /** Length = installments. Sum is exactly poolCents. */
  installmentCents: number[];
};

/**
 * Splits the fee into commission + pool and the pool into installments.
 * The remainder (cents that do not divide evenly) goes to the first
 * installments, one cent each, so the sum is exact.
 */
export function buildSchedule(
  feeCents: number,
  config: Partial<CashbackConfig> = {},
): CashbackSchedule {
  const { commissionBps, installments } = { ...DEFAULT_CONFIG, ...config };
  if (!Number.isInteger(feeCents) || feeCents <= 0) {
    throw new RangeError("feeCents must be a positive integer");
  }
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) {
    throw new RangeError("commissionBps must be an integer in [0, 10000]");
  }
  if (!Number.isInteger(installments) || installments < 1) {
    throw new RangeError("installments must be a positive integer");
  }

  const commissionCents = Math.round((feeCents * commissionBps) / 10000);
  const poolCents = feeCents - commissionCents;
  const base = Math.floor(poolCents / installments);
  const remainder = poolCents - base * installments;
  const installmentCents = Array.from({ length: installments }, (_, i) =>
    i < remainder ? base + 1 : base,
  );
  return { feeCents, commissionCents, poolCents, installmentCents };
}

/** Adds whole months in UTC, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsUTC(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      y,
      m,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

export type ContractMonth = {
  /** 1-based installment number. */
  index: number;
  /** Inclusive start. */
  start: Date;
  /** Exclusive end. */
  end: Date;
};

/** The [start, end) window of contract month `index` (1-based). */
export function contractMonthWindow(contractStart: Date, index: number): ContractMonth {
  if (!Number.isInteger(index) || index < 1) {
    throw new RangeError("index must be a positive integer");
  }
  return {
    index,
    start: addMonthsUTC(contractStart, index - 1),
    end: addMonthsUTC(contractStart, index),
  };
}

/**
 * Contract months that are fully over at `now` (end <= now), capped at the
 * number of installments. These are the months that can be evaluated.
 */
export function closedMonths(
  contractStart: Date,
  now: Date,
  installments: number = DEFAULT_INSTALLMENTS,
): ContractMonth[] {
  const out: ContractMonth[] = [];
  for (let i = 1; i <= installments; i++) {
    const w = contractMonthWindow(contractStart, i);
    if (w.end.getTime() <= now.getTime()) out.push(w);
    else break;
  }
  return out;
}

export type QualifyingSession = {
  /** True when the activity is a resistance/strength workout. */
  isStrength: boolean;
};

export type MonthEvaluation = {
  validSessions: number;
  strengthSessions: number;
  requiredSessions: number;
  minStrengthSessions: number;
  qualifies: boolean;
};

/** Decides whether a month's (already server-validated) sessions earn the installment. */
export function evaluateMonth(
  sessions: readonly QualifyingSession[],
  config: Partial<CashbackConfig> = {},
): MonthEvaluation {
  const { requiredSessions, minStrengthSessions } = { ...DEFAULT_CONFIG, ...config };
  const validSessions = sessions.length;
  const strengthSessions = sessions.filter((s) => s.isStrength).length;
  return {
    validSessions,
    strengthSessions,
    requiredSessions,
    minStrengthSessions,
    qualifies: validSessions >= requiredSessions && strengthSessions >= minStrengthSessions,
  };
}

export type InstallmentOutcome = "paid" | "forfeited";

export function installmentOutcome(evaluation: MonthEvaluation): InstallmentOutcome {
  return evaluation.qualifies ? "paid" : "forfeited";
}
