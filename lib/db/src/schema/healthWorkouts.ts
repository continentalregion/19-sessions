import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  real,
  serial,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const healthSourceKindEnum = ["healthkit", "health_connect"] as const;

/**
 * Raw workouts synced from HealthKit / Health Connect, with the SERVER-side
 * verdict. Invalid workouts are kept (with reasons) for audit and disputes.
 * `is_valid` is only ever written by the server validator, never by the client.
 */
export const healthWorkoutsTable = pgTable(
  "health_workouts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    source: text("source", { enum: healthSourceKindEnum }).notNull(),
    externalId: text("external_id").notNull(),
    activityType: text("activity_type").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    avgHeartRate: real("avg_heart_rate"),
    userEntered: boolean("user_entered").notNull(),
    fromWearable: boolean("from_wearable").notNull(),
    isStrength: boolean("is_strength").notNull().default(false),
    isValid: boolean("is_valid").notNull(),
    rejectReasons: jsonb("reject_reasons").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("health_workouts_user_source_ext_uq").on(t.userId, t.source, t.externalId),
    index("health_workouts_user_end_idx").on(t.userId, t.endAt),
  ],
);

export type HealthWorkout = typeof healthWorkoutsTable.$inferSelect;
export type InsertHealthWorkout = typeof healthWorkoutsTable.$inferInsert;
