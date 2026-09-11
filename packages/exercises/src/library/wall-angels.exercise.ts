import type { ExerciseDefinition } from '../types.js';

/** Wall angels. Shoulder abduction seen from the front. */
export const wallAngels: ExerciseDefinition = {
  id: 'wall-angels',
  names: { es: 'Ángeles en la pared', en: 'Wall angels' },
  synonyms: {
    es: ['ángeles de pared', 'wall angels', 'deslizamiento en pared'],
    en: ['wall angels', 'wall slides', 'wall angel'],
  },
  area: 'neckShoulders',
  position: 'standing',
  equipment: 'none',
  view: { orientation: 'front', cameraHeight: 'chair', distanceMetres: 3 },
  cameraTipKey: 'tip.chairFront',
  metrics: {
    shoulder: { id: 'shoulderAbduction', side: 'mean' },
    elbow: { id: 'elbowFlexion', side: 'mean' },
  },
  primaryMetric: 'shoulder',
  mode: 'reps',
  phases: [
    { id: 'down', when: { below: 100 }, minDwellMs: 300 },
    { id: 'up', when: { above: 130 }, minDwellMs: 500 },
  ],
  targets: { direction: 'increase', band: { min: 150, max: 180 }, safety: { min: 0, max: 185 } },
  rules: [
    {
      id: 'elbowsForward',
      priority: 'form',
      when: { metric: 'elbow', below: 70 },
      sustainMs: 800,
      cooldownMs: 6000,
      cueKey: 'cue.armsToWall',
    },
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 75 },
      sustainMs: 500,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 2, reps: 10, restSeconds: 40 },
  trackingConfidence: 'high',
  reference: {
    posture: 'standing',
    cycleSeconds: 5,
    base: { hipAngle: 176, kneeAngle: 176, hipAbduction: 5, shoulderAngle: 4 },
    keyframes: [
      { t: 0, pose: { shoulderAbduction: 85, elbowAngle: 90 } },
      { t: 0.45, pose: { shoulderAbduction: 160, elbowAngle: 160 } },
      { t: 0.6, pose: { shoulderAbduction: 160, elbowAngle: 160 } },
      { t: 1, pose: { shoulderAbduction: 85, elbowAngle: 90 } },
    ],
  },
};
