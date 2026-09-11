# Models and licences

Kinetrace runs every model on the device. Nothing is sent anywhere.

## Pose (required, self-hosted)

| Model                             | Size    | Licence            | Used for               |
| --------------------------------- | ------- | ------------------ | ---------------------- |
| MediaPipe Pose Landmarker `lite`  | 5.5 MB  | Apache 2.0, Google | Weak devices           |
| MediaPipe Pose Landmarker `full`  | 9.0 MB  | Apache 2.0, Google | Default                |
| MediaPipe Pose Landmarker `heavy` | 29.2 MB | Apache 2.0, Google | Laptops, hardest views |

Fetched by `pnpm models:fetch` into `apps/web/public/models/` and verified against
`scripts/models/checksums.json`. The Vercel build runs the same script, so a
deployed Kinetrace serves the models from its own origin.

The MediaPipe WASM runtime is copied from `@mediapipe/tasks-vision` into
`apps/web/public/mediapipe/wasm/` by the same script.

## Sheet import (optional, downloaded on demand)

| Model                       | Size         | Licence             | Used for                         |
| --------------------------- | ------------ | ------------------- | -------------------------------- |
| Tesseract `spa` + `eng`     | about 15 MB  | Apache 2.0          | OCR fallback, works everywhere   |
| Qwen2.5 1.5B Instruct q4f16 | about 950 MB | Apache 2.0, Alibaba | Structuring the sheet            |
| Qwen2.5 3B Instruct q4f16   | about 1.8 GB | Apache 2.0, Alibaba | Structuring, devices with memory |

None of these is needed for the core loop. The routine builder and the session work
without them, and the import falls back to lexical matching on the library's own
names and synonyms.

## Speech

Cues are spoken through the browser's own Web Speech Synthesis voices. Nothing is
downloaded and nothing is sent anywhere.
