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

## Voice commands (optional, downloaded on demand)

| Model                     | Size         | Licence     | Used for                   |
| ------------------------- | ------------ | ----------- | -------------------------- |
| Whisper `tiny` (ONNX, q4) | about 75 MB  | MIT, OpenAI | Default, multilingual      |
| Whisper `base` (ONNX, q4) | about 150 MB | MIT, OpenAI | Harder rooms, multilingual |

Off until the user turns them on in settings, because they cost a download and a
microphone permission. Fetched from Hugging Face through
[`@huggingface/transformers`](https://github.com/huggingface/transformers.js) and
kept in the browser's cache afterwards; the ONNX runtime's WebAssembly is served
from Kinetrace's own origin, not a CDN. WebGPU is required — on a device without
it the setting is disabled rather than falling back to something too slow to be
useful mid-exercise.

The audio is processed in a worker on the device and is never stored or sent
anywhere. Recognition only runs when the energy gate hears somebody speak, and
never while Kinetrace is speaking a cue.

Deliberately _not_ the Web Speech Recognition API: in most browsers it ships the
audio to the vendor's servers, which Kinetrace's privacy promise does not allow.

## Speech

Cues are spoken through the browser's own Web Speech Synthesis voices. Nothing is
downloaded and nothing is sent anywhere.
