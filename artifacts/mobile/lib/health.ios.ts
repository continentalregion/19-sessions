import AppleHealthKit, {
  type HealthKitPermissions,
  type AnchoredQueryResults,
  type HKErrorResponse,
} from "react-native-health";
import type { HealthCheckResult } from "./health";

export type { HealthSource } from "./health";

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [AppleHealthKit.Constants.Permissions.Workout],
    write: [],
  },
};

export async function checkWorkoutValidity(
  startedAt: Date,
  minDurationMs: number,
): Promise<HealthCheckResult> {
  const minDurationSeconds = minDurationMs / 1000;

  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (initErr: string) => {
      if (initErr) {
        resolve({ isValid: false, healthSource: "healthkit" });
        return;
      }

      const options = {
        startDate: startedAt.toISOString(),
        endDate: new Date().toISOString(),
        ascending: false,
        limit: 10,
      };

      AppleHealthKit.getAnchoredWorkouts(
        options,
        (queryErr: HKErrorResponse, results: AnchoredQueryResults) => {
          if (queryErr || !results?.data?.length) {
            resolve({ isValid: false, healthSource: "healthkit" });
            return;
          }

          const hasValidWorkout = results.data.some(
            (sample) => sample.duration >= minDurationSeconds,
          );

          resolve({ isValid: hasValidWorkout, healthSource: "healthkit" });
        },
      );
    });
  });
}
