import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  type Frame,
} from "react-native-vision-camera";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { useSharedValue } from "react-native-worklets-core";

import { useColors } from "@/hooks/useColors";
import { usePoseModel, POSE_MODEL_INPUT_SIZE } from "@/hooks/usePoseModel";
import type { PoseKeypoints } from "@/lib/pose/types";

interface PoseCameraViewProps {
  /** Called on the JS thread whenever a fresh pose is decoded from a frame. */
  onPose: (pose: PoseKeypoints) => void;
  /** When false, the frame processor is paused (camera preview stays mounted). */
  isActive: boolean;
}

/**
 * Renders the live camera preview and runs the MoveNet frame processor
 * continuously in the background; callers (session.tsx) sample the latest
 * pose only at the scheduled "scatti" checkpoints via `onPose`.
 *
 * This component requires a native EAS dev/production build —
 * react-native-vision-camera frame processors are not supported in Expo Go.
 */
export function PoseCameraView({ onPose, isActive }: PoseCameraViewProps) {
  const colors = useColors();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");
  const model = usePoseModel();
  const { resize } = useResizePlugin();
  const lastPoseRef = useRef<PoseKeypoints | null>(null);
  const latestPoseShared = useSharedValue<PoseKeypoints | null>(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      "worklet";
      if (!model) return;

      const resized = resize(frame, {
        scale: {
          width: POSE_MODEL_INPUT_SIZE,
          height: POSE_MODEL_INPUT_SIZE,
        },
        pixelFormat: "rgb",
        dataType: "uint8",
      });

      const outputs = model.runSync([resized.buffer as ArrayBuffer]);
      // Output tensor shape [1, 1, 17, 3] flattened -> 17 * (y, x, score).
      const raw = new Float32Array(outputs[0]);
      const normalized: PoseKeypoints = [];
      for (let i = 0; i < 17; i++) {
        const base = i * 3;
        normalized.push({
          y: raw[base],
          x: raw[base + 1],
          score: raw[base + 2],
        });
      }

      latestPoseShared.value = normalized;
    },
    [model, resize],
  );

  // Bridge the worklet's shared value to JS-thread state at a fixed cadence,
  // decoupled from frame rate, so checkpoint sampling in session.tsx always
  // reads a recent pose without re-rendering on every camera frame.
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      const pose = latestPoseShared.value;
      if (pose && pose !== lastPoseRef.current) {
        lastPoseRef.current = pose;
        onPose(pose);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [isActive, latestPoseShared, onPose]);

  if (!device) {
    return (
      <View style={[styles.fallback, { backgroundColor: colors.muted }]}>
        <Text style={{ color: colors.mutedForeground }}>
          Nessuna camera frontale disponibile
        </Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.fallback, { backgroundColor: colors.muted }]}>
        <Text style={{ color: colors.mutedForeground }}>
          Permesso camera richiesto per validare la sessione
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
  },
  fallback: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
});
