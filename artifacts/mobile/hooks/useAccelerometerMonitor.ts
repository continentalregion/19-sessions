import { Accelerometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import type { ExerciseCategory } from "@/constants/circuits";

const SAMPLE_INTERVAL_MS = 200;
const WINDOW_SIZE = 15; // ~3s rolling window at 200ms interval

/** Expected magnitude-variance intensity band per exercise category, tuned
 * for a phone held in an armband / propped nearby during BOSU training.
 * These are on-device heuristics, not exact biomechanical thresholds — the
 * accelerometer's job here is only to confirm "sustained plausible motion",
 * not to grade form (that's the camera's job at each scatto checkpoint). */
const INTENSITY_BANDS: Record<ExerciseCategory, { min: number; max: number }> = {
  balance_core: { min: 0.01, max: 0.35 },
  lower_strength: { min: 0.04, max: 0.9 },
  upper_strength: { min: 0.03, max: 0.8 },
  cardio: { min: 0.08, max: 3.0 },
};

interface MotionSample {
  variance: number;
  timestampMs: number;
}

export interface AccelerometerMonitorState {
  isCoherent: boolean;
  currentVariance: number;
  sampleCount: number;
  coherentSampleCount: number;
}

/**
 * Confirms continuous plausible movement for the current exercise category
 * between camera "scatti" checkpoints. Never gates session validity alone —
 * it only contributes to reliability scoring alongside the camera checks
 * (see docs/architecture-plan.md section 4).
 */
export function useAccelerometerMonitor(
  category: ExerciseCategory | null,
  active: boolean,
): AccelerometerMonitorState {
  const [state, setState] = useState<AccelerometerMonitorState>({
    isCoherent: true,
    currentVariance: 0,
    sampleCount: 0,
    coherentSampleCount: 0,
  });

  const windowRef = useRef<MotionSample[]>([]);
  const totalsRef = useRef({ sampleCount: 0, coherentSampleCount: 0 });

  useEffect(() => {
    if (!active || !category) return;

    windowRef.current = [];
    totalsRef.current = { sampleCount: 0, coherentSampleCount: 0 };
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      windowRef.current.push({ variance: magnitude, timestampMs: Date.now() });
      if (windowRef.current.length > WINDOW_SIZE) windowRef.current.shift();

      if (windowRef.current.length < 3) return;

      const mags = windowRef.current.map((s) => s.variance);
      const mean = mags.reduce((sum, m) => sum + m, 0) / mags.length;
      const variance =
        mags.reduce((sum, m) => sum + (m - mean) ** 2, 0) / mags.length;

      const band = INTENSITY_BANDS[category];
      const coherent = variance >= band.min && variance <= band.max;

      totalsRef.current.sampleCount += 1;
      if (coherent) totalsRef.current.coherentSampleCount += 1;

      setState({
        isCoherent: coherent,
        currentVariance: variance,
        sampleCount: totalsRef.current.sampleCount,
        coherentSampleCount: totalsRef.current.coherentSampleCount,
      });
    });

    return () => subscription.remove();
  }, [active, category]);

  return state;
}
