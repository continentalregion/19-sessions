# Pose estimation model

`movenet_lightning.tflite` in this directory is a **0-byte placeholder** so Metro
can resolve the `require(...)` call in `hooks/usePoseModel.ts` without an EAS
build. It is NOT a real model and pose estimation will fail at runtime until
it's replaced.

## Before an EAS dev/production build

Download the real MoveNet Lightning (int8, 192x192 input) TFLite model and
overwrite this file, e.g.:

```bash
curl -L "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/int8/4?lite-format=tflite" \
  -o artifacts/mobile/assets/models/movenet_lightning.tflite
```

Verify the file is a few MB (not 0 bytes) before building. If Google swaps the
hosting URL, search "movenet lightning tflite int8" on tfhub.dev/kaggle models
for the current link — the model architecture is unaffected, only the file host
changes over time.
