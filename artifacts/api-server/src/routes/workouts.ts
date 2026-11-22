import { Router, type IRouter, type RequestHandler } from "express";
import { and, eq, gte, lte } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { z } from "zod/v4";
import { db, healthWorkoutsTable } from "@workspace/db";
import {
  STRENGTH_TYPES,
  validateBatch,
  type AcceptedSession,
  type RawWorkout,
} from "../lib/sessionValidator";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
};

const WorkoutInput = z.object({
  externalId: z.string().min(1).max(128),
  source: z.enum(["healthkit", "health_connect"]),
  activityType: z.string().min(1).max(64),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  userEntered: z.boolean(),
  fromWearable: z.boolean(),
  avgHeartRate: z.number().positive().max(400).nullish(),
});

const SyncBody = z.object({ workouts: z.array(WorkoutInput).min(1).max(100) });

/**
 * POST /api/workouts/sync
 * The app uploads RAW health records. The server decides validity; there is no
 * client-supplied "isValid". userId comes only from the verified Clerk session.
 */
router.post("/workouts/sync", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId as string;

  const parsed = SyncBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const batch: RawWorkout[] = parsed.data.workouts.map((w) => ({
    ...w,
    avgHeartRate: w.avgHeartRate ?? null,
  }));

  const now = new Date();
  const minStart = new Date(Math.min(...batch.map((w) => w.startAt.getTime())) - 24 * 3600 * 1000);
  const maxEnd = new Date(Math.max(...batch.map((w) => w.endAt.getTime())) + 24 * 3600 * 1000);

  // Every row already stored near the batch's time span (valid or not): used for
  // duplicate detection. Only valid ones count for overlap / daily cap.
  const existing = await db
    .select()
    .from(healthWorkoutsTable)
    .where(
      and(
        eq(healthWorkoutsTable.userId, userId),
        gte(healthWorkoutsTable.endAt, minStart),
        lte(healthWorkoutsTable.startAt, maxEnd),
      ),
    );
  const seen = new Set(existing.map((e) => `${e.source}:${e.externalId}`));
  const accepted: AcceptedSession[] = existing
    .filter((e) => e.isValid)
    .map((e) => ({
      externalId: e.externalId,
      source: e.source,
      startAt: e.startAt,
      endAt: e.endAt,
    }));

  const fresh = batch.filter((w) => !seen.has(`${w.source}:${w.externalId}`));
  const results = validateBatch(fresh, accepted, now);

  if (results.length > 0) {
    await db
      .insert(healthWorkoutsTable)
      .values(
        results.map(({ workout: w, verdict }) => ({
          userId,
          source: w.source,
          externalId: w.externalId,
          activityType: w.activityType,
          startAt: w.startAt,
          endAt: w.endAt,
          durationSeconds: Math.round((w.endAt.getTime() - w.startAt.getTime()) / 1000),
          avgHeartRate: w.avgHeartRate ?? null,
          userEntered: w.userEntered,
          fromWearable: w.fromWearable,
          isStrength: STRENGTH_TYPES.has(w.activityType),
          isValid: verdict.valid,
          rejectReasons: verdict.reasons,
        })),
      )
      .onConflictDoNothing();
  }

  res.status(200).json({
    received: batch.length,
    duplicates: batch.length - fresh.length,
    results: results.map(({ workout, verdict }) => ({
      externalId: workout.externalId,
      source: workout.source,
      valid: verdict.valid,
      reasons: verdict.reasons,
    })),
  });
});

export default router;
