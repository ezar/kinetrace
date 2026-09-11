/**
 * Pose model variants.
 *
 * Models are self-hosted under `public/models/` and fetched at build time by
 * `pnpm models:fetch`, so a Kinetrace install talks to no third party at
 * runtime. Sizes are shown in Settings before anything is downloaded.
 */

export type PoseModelVariant = 'lite' | 'full' | 'heavy';

export interface PoseModelInfo {
  variant: PoseModelVariant;
  /** Path relative to the base the app is served from. */
  path: string;
  /** Approximate download size in megabytes. */
  sizeMb: number;
  /** Preferred inference delegate. WASM is the fallback when WebGL is unavailable. */
  delegate: 'GPU' | 'CPU';
}

export const POSE_MODELS: Record<PoseModelVariant, PoseModelInfo> = {
  lite: {
    variant: 'lite',
    path: 'models/pose_landmarker_lite.task',
    sizeMb: 5.5,
    delegate: 'GPU',
  },
  full: {
    variant: 'full',
    path: 'models/pose_landmarker_full.task',
    sizeMb: 9.0,
    delegate: 'GPU',
  },
  heavy: {
    variant: 'heavy',
    path: 'models/pose_landmarker_heavy.task',
    sizeMb: 29.2,
    delegate: 'GPU',
  },
};

/**
 * Pick a starting variant for this device. Phones with few cores or little
 * memory start on `lite`; everything else starts on `full`, which is the
 * variant the library thresholds were tuned against.
 */
export function suggestVariant(): PoseModelVariant {
  if (typeof navigator === 'undefined') return 'full';
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return cores <= 4 || memory <= 3 ? 'lite' : 'full';
}
