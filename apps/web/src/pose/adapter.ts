/**
 * MediaPipe pose adapter.
 *
 * Runs on the main thread with `requestVideoFrameCallback`, because the GPU
 * delegate needs the canvas context there. Frames are converted into the
 * engine's coordinate convention and handed to the worker; the pixels are never
 * copied, stored or sent anywhere.
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark, PoseFrame, Vec3 } from '@kinetrace/engine';
import { LANDMARK_COUNT } from '@kinetrace/engine';
import { POSE_MODELS, type PoseModelVariant } from './models.js';
import { assetUrl } from '../assets.js';

export interface PoseAdapterOptions {
  variant: PoseModelVariant;
  /** Root of the MediaPipe WASM files, served from the app itself. */
  wasmRoot?: string;
}

const DEFAULT_WASM_ROOT = 'mediapipe/wasm';

/**
 * MediaPipe reports image landmarks with Y growing downwards and world
 * landmarks in metres with Y down and Z growing away from the camera. The
 * engine works in a right-handed frame with Y up and Z towards the camera, so
 * both Y and Z are flipped, which preserves handedness.
 */
function toWorldLandmark(landmark: {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}): Landmark {
  return {
    x: landmark.x,
    y: -landmark.y,
    z: -landmark.z,
    visibility: landmark.visibility ?? 0,
  };
}

function toImageLandmark(landmark: {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}): Landmark {
  return { x: landmark.x, y: landmark.y, z: landmark.z, visibility: landmark.visibility ?? 0 };
}

export class PoseAdapter {
  private constructor(
    private readonly landmarker: PoseLandmarker,
    readonly variant: PoseModelVariant,
    readonly delegate: 'GPU' | 'CPU',
  ) {}

  static async create(options: PoseAdapterOptions): Promise<PoseAdapter> {
    const model = POSE_MODELS[options.variant];
    const fileset = await FilesetResolver.forVisionTasks(
      assetUrl(options.wasmRoot ?? DEFAULT_WASM_ROOT),
    );
    for (const delegate of ['GPU', 'CPU'] as const) {
      try {
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: assetUrl(model.path), delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
        });
        return new PoseAdapter(landmarker, options.variant, delegate);
      } catch (error) {
        if (delegate === 'CPU') throw error;
      }
    }
    throw new Error('Pose model could not be created');
  }

  /**
   * Detect one frame.
   *
   * @param timestampMs Monotonic timestamp, must increase between calls.
   * @param gravityUp Gravity reference in the engine frame, when the device reports it.
   */
  detect(video: HTMLVideoElement, timestampMs: number, gravityUp?: Vec3): PoseFrame | null {
    const result = this.landmarker.detectForVideo(video, timestampMs);
    const image = result.landmarks[0];
    const world = result.worldLandmarks[0];
    if (!image || image.length < LANDMARK_COUNT) return null;
    return {
      timestampMs,
      image: image.map(toImageLandmark),
      world: world ? world.map(toWorldLandmark) : [],
      gravityUp,
    };
  }

  close(): void {
    this.landmarker.close();
  }
}
