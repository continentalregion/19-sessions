import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  annualContractsTable,
  cashbackLedgerTable,
  healthWorkoutsTable,
  type AnnualContract,
} from "@workspace/db";
import {
  closedMonths,
  contractMonthWindow,
  buildSchedule,
  evaluateMonth,
  installmentOutcome,
} from "../lib/cashbackEngine";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
};

function secretMatches(provided: unknown): boolean {
  const expected = process.env["CRON_SECRET"];
  if (!expected || typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function validSessionsIn(userId: string, start: Date, end: Date) {
  return db
    .select({ isStrength: healthWorkoutsTable.isStrength })
    .from(healthWorkoutsTable)
    .where(
      and(
        eq(healthWorkoutsTable.userId, userId),
        eq(healthWorkoutsTable.isValid, true),
        gte(healthWorkoutsTable.endAt, start),
        lt(healthWorkoutsTable.endAt, end),
      ),
    );
}

/**
 * GET /api/contract/status — the signed-in user's latest contract, the
 * installment schedule, ledger outcomes so far and live progress this month.
 */
router.get("/contract/status", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId as string;
  const [contract] = await db
    .select()
    .from(annualContractsTable)
    .where(eq(annualContractsTable.userId, userId))
    .orderBy(desc(annualContractsTable.id))
    .limit(1);

  if (!contract) {
    res.status(404).json({ error: "No contract" });
    return;
  }

  const schedule = buildSchedule(contract.feeCents, {
    installments: 12,
  });
  const ledger = await db
    .select()
    .from(cashbackLedgerTable)
    .where(eq(cashbackLedgerTable.contractId, contract.id));

  let currentMonth: Record<string, unknown> | null = null;
  if (contract.status === "active" && contract.startAt) {
    const now = new Date();
    const closed = closedMonths(contract.startAt, now).length;
    if (closed < 12) {
      const w = contractMonthWindow(contract.startAt, closed + 1);
      const sessions = await validSessionsIn(userId, w.start, w.end);
      const ev = evaluateMonth(sessions, {
        requiredSessions: contract.requiredSessions,
        minStrengthSessions: contract.minStrengthSessions,
      });
      currentMonth = {
        installmentIndex: w.index,
        start: w.start.toISOString(),
        end: w.end.toISOString(),
        validSessions: ev.validSessions,
        strengthSessions: ev.strengthSessions,
        requiredSessions: ev.requiredSessions,
        minStrengthSessions: ev.minStrengthSessions,
        installmentCents: schedule.installmentCents[closed] ?? 0,
      };
    }
  }

  res.json({
    contract: {
      id: contract.id,
      status: contract.status,
      feeCents: contract.feeCents,
      commissionCents: contract.commissionCents,
      poolCents: contract.poolCents,
      startAt: contract.startAt?.toISOString() ?? null,
    },
    installmentCents: schedule.installmentCents,
    ledger: ledger
      .sort((a, b) => a.installmentIndex - b.installmentIndex)
      .map((l) => ({
        installmentIndex: l.installmentIndex,
        amountCents: l.amountCents,
        validSessions: l.validSessions,
        outcome: l.outcome,
      })),
    currentMonth,
  });
});

/**
 * POST /api/cashback/cycle — cron only (x-cron-secret). Evaluates every closed
 * contract month for every active contract and writes one ledger row per
 * (contract, installment). Idempotent: the unique index prevents double credit.
 * It does NOT move money: rows are written as "payable" and a payout adapter
 * (EMI / bank transfer) settles them separately.
 */
router.post("/cashback/cycle", async (req, res): Promise<void> => {
  if (!secretMatches(req.headers["x-cron-secret"])) {
    res.status(401).json({ error: "Missing or invalid cron secret" });
    return;
  }

  const now = new Date();
  const contracts: AnnualContract[] = await db
    .select()
    .from(annualContractsTable)
    .where(eq(annualContractsTable.status, "active"));

  let created = 0;
  let completed = 0;

  for (const c of contracts) {
    if (!c.startAt) continue;
    const schedule = buildSchedule(c.feeCents);
    const closed = closedMonths(c.startAt, now);

    for (const m of closed) {
      const sessions = await validSessionsIn(c.userId, m.start, m.end);
      const ev = evaluateMonth(sessions, {
        requiredSessions: c.requiredSessions,
        minStrengthSessions: c.minStrengthSessions,
      });
      const outcome = installmentOutcome(ev);
      const inserted = await db
        .insert(cashbackLedgerTable)
        .values({
          contractId: c.id,
          installmentIndex: m.index,
          amountCents: schedule.installmentCents[m.index - 1] ?? 0,
          validSessions: ev.validSessions,
          strengthSessions: ev.strengthSessions,
          outcome: outcome === "paid" ? "payable" : "forfeited",
        })
        .onConflictDoNothing()
        .returning({ id: cashbackLedgerTable.id });
      created += inserted.length;
    }

    if (closed.length >= 12) {
      await db
        .update(annualContractsTable)
        .set({ status: "completed" })
        .where(eq(annualContractsTable.id, c.id));
      completed += 1;
    }
  }

  res.json({ contractsEvaluated: contracts.length, ledgerRowsCreated: created, contractsCompleted: completed });
});

export default router;
