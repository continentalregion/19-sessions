import { pgTable, text, timestamp, integer, serial, uniqueIndex, index } from "drizzle-orm/pg-core";

export const contractStatusEnum = ["pending_payment", "active", "completed", "canceled"] as const;
export const ledgerOutcomeEnum = ["payable", "paid_out", "forfeited"] as const;

/** One annual contract = one upfront fee, 12 conditional monthly installments. */
export const annualContractsTable = pgTable(
  "annual_contracts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    feeCents: integer("fee_cents").notNull(),
    commissionCents: integer("commission_cents").notNull(),
    poolCents: integer("pool_cents").notNull(),
    requiredSessions: integer("required_sessions").notNull().default(19),
    minStrengthSessions: integer("min_strength_sessions").notNull().default(0),
    status: text("status", { enum: contractStatusEnum }).notNull().default("pending_payment"),
    /** Set when payment is confirmed; anchors the 12 anniversary months. */
    startAt: timestamp("start_at", { withTimezone: true }),
    paymentRef: text("payment_ref"),
    /** Explicit consent to the contract terms (incl. rule for non-earned installments). */
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    termsVersion: text("terms_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("annual_contracts_user_idx").on(t.userId)],
);

/**
 * One row per (contract, installment). The unique index makes the monthly
 * cycle idempotent: re-running it can never double-credit a user.
 * Amounts are frozen at evaluation time.
 */
export const cashbackLedgerTable = pgTable(
  "cashback_ledger",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id").notNull(),
    installmentIndex: integer("installment_index").notNull(),
    amountCents: integer("amount_cents").notNull(),
    validSessions: integer("valid_sessions").notNull(),
    strengthSessions: integer("strength_sessions").notNull(),
    outcome: text("outcome", { enum: ledgerOutcomeEnum }).notNull(),
    payoutRef: text("payout_ref"),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cashback_ledger_contract_idx_uq").on(t.contractId, t.installmentIndex)],
);

export type AnnualContract = typeof annualContractsTable.$inferSelect;
export type CashbackLedgerRow = typeof cashbackLedgerTable.$inferSelect;
