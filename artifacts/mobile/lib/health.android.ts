import { initialize, requestPermission, readRecords } from "react-native-health-connect";
import type { HealthCheckResult } from "./health";

export type { HealthSource } from "./health";

export async function checkWorkoutValidity(
  startedAt: Date,
  minDurationMs: number,
): Promise<HealthCheckResult> {
  try {
    const isAvailable = await initialize();
    if (!isAvailable) {
      return { isValid: false, healthSource: "health_connect" };
    }

    await requestPermission([{ accessType: "read", recordType: "ExerciseSession" }]);

    const endTime = new Date();
    const result = await readRecords("ExerciseSession", {
      timeRangeFilter: {
        operator: "between",
        startTime: startedAt.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    const hasValidWorkout = result.records.some((record) => {
      const duration =
        new Date(record.endTime).getTime() - new Date(record.startTime).getTime();
      return duration >= minDurationMs;
    });

    return { isValid: hasValidWorkout, healthSource: "health_connect" };
  } catch {
    return { isValid: false, healthSource: "health_connect" };
  }
}
