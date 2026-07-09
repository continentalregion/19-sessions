---
name: Expo vision-camera frame processor version compatibility
description: Which react-native-vision-camera major version to use with react-native-fast-tflite + vision-camera-resize-plugin for on-device ML frame processing.
---

`react-native-vision-camera@5.x` is a full Nitro-based rewrite that removed the classic `useFrameProcessor`/`frameProcessor` prop and `VisionCameraProxy` plugin API. Frame-processor-based plugins (`react-native-fast-tflite`, `vision-camera-resize-plugin`) still target the older API.

**Why:** installing v5 causes TS errors like "no exported member 'useFrameProcessor'" and prop-type mismatches on `<Camera frameProcessor={...} />`, because that API no longer exists in v5.

**How to apply:** pin `react-native-vision-camera` to the `^4.x` line (e.g. `4.7.3`) when building a custom frame-processor pipeline (pose estimation, barcode/ML plugins, resize plugin). Also note `resize()` from `vision-camera-resize-plugin` returns a typed array (`Uint8Array`/`Float32Array`), not an `ArrayBuffer` — pass `.buffer` when feeding it into `fast-tflite`'s `runSync(ArrayBuffer[])`. After changing the major version, run a full workspace `pnpm install` (not just the package's own install) to fix stale peer-dependency resolution in the pnpm store.
