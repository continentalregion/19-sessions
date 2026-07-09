import { pgTable, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// current_level is 0-11 (zero-based) in data/logic.
// UI/text maps this to "Livello 1-12" (current_level + 1) for display only.
export const pricingStateTable = pgTable("pricing_state", {
  userId: text("user_id").primaryKey(),
  currentLevel: integer("current_level").notNull().default(0),
  lastMonthCompleted: boolean("last_month_completed").notNull().default(false),
  avgReliabilityScoreMonth: real("avg_reliability_score_month"),
  subscriptionStartedAt: timestamp("subscription_started_at", { withTimezone: true }),
  cycleMonthCounter: integer("cycle_month_counter").notNull().default(0),
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
