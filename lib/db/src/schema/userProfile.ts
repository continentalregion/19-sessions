import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainingGoalEnum = [
  "muscle_tone",
  "posture",
  "cardio_general",
  "weight_loss",
] as const;

export const userProfileTable = pgTable("user_profile", {
  userId: text("user_id").primaryKey(),
  trainingGoal: text("training_goal", { enum: trainingGoalEnum }).notNull(),
  goalLockedUntil: timestamp("goal_locked_until", { withTimezone: true }).notNull(),
  preferredLanguage: text("preferred_language").notNull().default("it"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserProfileSchema = createInsertSchema(userProfileTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfileTable.$inferSelect;
