import { useTensorflowModel } from "react-native-fast-tflite";

/**
 * Loads the on-device MoveNet Lightning pose estimation model (bundled as a
 * Metro asset, see artifacts/mobile/assets/models/README.md for how to
 * provision the actual .tflite binary before an EAS build).
 *
 * Input: 192x192x3 uint8 RGB frame.
 * Output: [1, 1, 17, 3] tensor -> 17 keypoints of (y, x, score).
 */
export function usePoseModel() {
  const model = useTensorflowModel(
    require("@/assets/models/movenet_lightning.tflite"),
    [],
  );
  return model.state === "loaded" ? model.model : null;
}

export const POSE_MODEL_INPUT_SIZE = 192;
