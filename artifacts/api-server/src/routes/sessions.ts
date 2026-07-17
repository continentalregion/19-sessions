import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { db, workoutSessionsTable } from "@workspace/db";
import { CreateWorkoutSessionBody, CreateWorkoutSessionResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
};

router.post("/sessions", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = CreateWorkoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { trainingGoal, durationSeconds, isValid, healthSource } = parsed.data;

  const [row] = await db
    .insert(workoutSessionsTable)
    .values({
      userId,
      trainingGoal: trainingGoal as "muscle_tone" | "posture" | "cardio_general" | "weight_loss",
      durationSeconds,
      isValid,
      healthSource: (healthSource ?? null) as "health_connect" | "healthkit" | null,
    })
    .returning({ id: workoutSessionsTable.id, createdAt: workoutSessionsTable.createdAt });

  if (!row) {
    req.log.error({ userId }, "Failed to insert workout session");
    res.status(500).json({ error: "Failed to save session" });
    return;
  }

  res.status(201).json(
    CreateWorkoutSessionResponse.parse({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    }),
  );
});

export default router;
