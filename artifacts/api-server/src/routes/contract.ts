import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod/v4";
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
import { getUncachableStripeClient } from "../lib/stripeClient";
import {
  CONTRACT_KIND,
  TERMS_VERSION,
  activateFromCheckoutSession,
  annualFeeCents,
  createPendingContract,
} from "../lib/contractService";

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
    totals: {
      earnedCents: ledger
        .filter((l) => l.outcome !== "forfeited")
        .reduce((a, l) => a + l.amountCents, 0),
      forfeitedCents: ledger
        .filter((l) => l.outcome === "forfeited")
        .reduce((a, l) => a + l.amountCents, 0),
    },
    currentMonth,
  });
});

function webBaseUrl(): string | null {
  const explicit = process.env["WEB_BASE_URL"];
  if (explicit) return explicit.replace(/\/$/, "");
  const replit = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  return replit ? `https://${replit}/site` : null;
}

const CheckoutBody = z.object({ acceptTerms: z.literal(true) });

/**
 * POST /api/contract/checkout — creates a pending contract and a Stripe
 * Checkout Session for the annual fee. Requires explicit acceptance of terms.
 */
router.post("/contract/checkout", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId as string;
  if (!CheckoutBody.safeParse(req.body).success) {
    res.status(400).json({ error: "Terms must be accepted" });
    return;
  }
  const base = webBaseUrl();
  if (!base) {
    res.status(500).json({ error: "WEB_BASE_URL is not configured" });
    return;
  }

  const [open] = await db
    .select()
    .from(annualContractsTable)
    .where(eq(annualContractsTable.userId, userId))
    .orderBy(desc(annualContractsTable.id))
    .limit(1);
  if (open && open.status === "active") {
    res.status(409).json({ error: "Active contract already exists" });
    return;
  }

  const contract =
    open && open.status === "pending_payment" ? open : await createPendingContract(userId);

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: userId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: contract.feeCents,
          product_data: { name: "19 Sessions — quota annuale" },
        },
      },
    ],
    metadata: { kind: CONTRACT_KIND, contractId: String(contract.id), userId, terms: TERMS_VERSION },
    success_url: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?checkout=cancel`,
  });

  await db
    .update(annualContractsTable)
    .set({ paymentRef: session.id })
    .where(eq(annualContractsTable.id, contract.id));

  res.json({ url: session.url, contractId: contract.id, feeCents: contract.feeCents });
});

const ConfirmBody = z.object({ sessionId: z.string().min(1).max(255) });

/**
 * POST /api/contract/confirm — called by the site after returning from Stripe.
 * The session is re-read from Stripe (never trusted from the client) and the
 * contract is activated only if it was really paid by this user.
 */
router.post("/contract/confirm", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId as string;
  const parsed = ConfirmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId);
  const contract = await activateFromCheckoutSession(session, userId);
  if (!contract) {
    res.status(409).json({ error: "Payment not confirmed" });
    return;
  }
  res.json({ status: contract.status, startAt: contract.startAt?.toISOString() ?? null });
});

/** GET /api/contract/offer — public: the fee and split shown before purchase. */
router.get("/contract/offer", (_req, res): void => {
  const fee = annualFeeCents();
  const s = buildSchedule(fee);
  res.json({
    feeCents: fee,
    commissionCents: s.commissionCents,
    poolCents: s.poolCents,
    installmentCents: s.installmentCents,
    requiredSessionsPerMonth: 19,
    minMinutesPerSession: 25,
    termsVersion: TERMS_VERSION,
  });
});

/**
 * GET /api/admin/summary — owner totals (x-cron-secret). Shows what the
 * platform has collected and what was retained from non-earned installments.
 */
router.get("/admin/summary", async (req, res): Promise<void> => {
  if (!secretMatches(req.headers["x-cron-secret"])) {
    res.status(401).json({ error: "Missing or invalid secret" });
    return;
  }
  const [c] = await db
    .select({
      activeContracts: sql<number>`count(*) filter (where ${annualContractsTable.status} = 'active')::int`,
      feesCollectedCents: sql<number>`coalesce(sum(${annualContractsTable.feeCents}) filter (where ${annualContractsTable.status} in ('active','completed')), 0)::int`,
      commissionCents: sql<number>`coalesce(sum(${annualContractsTable.commissionCents}) filter (where ${annualContractsTable.status} in ('active','completed')), 0)::int`,
    })
    .from(annualContractsTable);
  const [l] = await db
    .select({
      retainedForfeitedCents: sql<number>`coalesce(sum(${cashbackLedgerTable.amountCents}) filter (where ${cashbackLedgerTable.outcome} = 'forfeited'), 0)::int`,
      payableCents: sql<number>`coalesce(sum(${cashbackLedgerTable.amountCents}) filter (where ${cashbackLedgerTable.outcome} = 'payable'), 0)::int`,
      paidOutCents: sql<number>`coalesce(sum(${cashbackLedgerTable.amountCents}) filter (where ${cashbackLedgerTable.outcome} = 'paid_out'), 0)::int`,
    })
    .from(cashbackLedgerTable);
  res.json({ ...c, ...l });
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
