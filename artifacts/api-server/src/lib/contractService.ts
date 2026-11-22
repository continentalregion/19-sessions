import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db, annualContractsTable } from "@workspace/db";
import { buildSchedule } from "./cashbackEngine";

export const TERMS_VERSION = "2026-11-v1";
export const CONTRACT_KIND = "annual_contract";

/** Annual fee in cents. Override with ANNUAL_FEE_CENTS (e.g. 100000 = 1000 EUR). */
export function annualFeeCents(): number {
  const raw = Number(process.env["ANNUAL_FEE_CENTS"] ?? 100_000);
  return Number.isInteger(raw) && raw > 0 ? raw : 100_000;
}

export async function createPendingContract(userId: string) {
  const feeCents = annualFeeCents();
  const s = buildSchedule(feeCents);
  const [row] = await db
    .insert(annualContractsTable)
    .values({
      userId,
      feeCents,
      commissionCents: s.commissionCents,
      poolCents: s.poolCents,
      status: "pending_payment",
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
    })
    .returning();
  return row!;
}

/**
 * Activates a pending contract from a PAID Stripe Checkout Session.
 * Idempotent: only a contract still in pending_payment transitions, so the
 * webhook and the browser confirm can both call it safely.
 * Returns the contract row, or null if the session does not match.
 */
export async function activateFromCheckoutSession(
  session: Stripe.Checkout.Session,
  expectedUserId?: string,
) {
  if (session.payment_status !== "paid") return null;
  if (session.metadata?.["kind"] !== CONTRACT_KIND) return null;
  const contractId = Number(session.metadata?.["contractId"]);
  const userId = session.metadata?.["userId"];
  if (!Number.isInteger(contractId) || !userId) return null;
  if (expectedUserId && expectedUserId !== userId) return null;

  const [contract] = await db
    .select()
    .from(annualContractsTable)
    .where(and(eq(annualContractsTable.id, contractId), eq(annualContractsTable.userId, userId)));
  if (!contract) return null;

  // The amount actually charged must equal the contract fee.
  if (session.amount_total !== contract.feeCents || session.currency !== "eur") return null;

  if (contract.status !== "pending_payment") return contract;

  const [updated] = await db
    .update(annualContractsTable)
    .set({ status: "active", startAt: new Date(), paymentRef: session.id })
    .where(
      and(eq(annualContractsTable.id, contractId), eq(annualContractsTable.status, "pending_payment")),
    )
    .returning();
  return updated ?? contract;
}
