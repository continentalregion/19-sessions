import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// current_level is 0-10 (zero-based) in data/logic.
// UI maps this to "Livello 1-11" (current_level + 1) for display only.
// Level 0 = 250 EUR (sessions ≤ 8), Level 10 = 10 EUR (sessions ≥ 18).
// No cycle counter — price is recalculated from scratch every month based
// solely on the previous month's valid session count.
export const pricingStateTable = pgTable("pricing_state", {
  userId: text("user_id").primaryKey(),
  currentLevel: integer("current_level").notNull().default(0),
  lastMonthCompleted: boolean("last_month_completed").notNull().default(false),
  subscriptionStartedAt: timestamp("subscription_started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPricingStateSchema = createInsertSchema(pricingStateTable).omit({
  updatedAt: true,
});
export type InsertPricingState = z.infer<typeof insertPricingStateSchema>;
export type PricingState = typeof pricingStateTable.$inferSelect;
