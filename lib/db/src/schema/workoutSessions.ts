import { pgTable, text, timestamp, integer, real, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { trainingGoalEnum } from "./userProfile";

export const verificationTierEnum = ["verified_base", "verified_enhanced"] as const;

export const workoutSessionsTable = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  trainingGoal: text("training_goal", { enum: trainingGoalEnum }).notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  camScattiValid: integer("cam_scatti_valid").notNull().default(0),
  camScattiInvalid: integer("cam_scatti_invalid").notNull().default(0),
  avgFormScore: real("avg_form_score"),
  deviceAttestationOk: boolean("device_attestation_ok").notNull().default(false),
  verificationTier: text("verification_tier", { enum: verificationTierEnum })
    .notNull()
    .default("verified_base"),
  reliabilityScore: real("reliability_score").notNull().default(1.0),
  isValid: boolean("is_valid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkoutSessionSchema = createInsertSchema(workoutSessionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;
export type WorkoutSession = typeof workoutSessionsTable.$inferSelect;
