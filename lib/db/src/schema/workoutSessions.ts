import { pgTable, text, timestamp, integer, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { trainingGoalEnum } from "./userProfile";

export const healthSourceEnum = ["health_connect", "healthkit"] as const;

export const workoutSessionsTable = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  trainingGoal: text("training_goal", { enum: trainingGoalEnum }).notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  healthSource: text("health_source", { enum: healthSourceEnum }),
  isValid: boolean("is_valid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkoutSessionSchema = createInsertSchema(workoutSessionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;
export type WorkoutSession = typeof workoutSessionsTable.$inferSelect;
