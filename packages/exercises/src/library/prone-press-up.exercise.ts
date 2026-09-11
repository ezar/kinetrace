import type { ExerciseDefinition } from '../types.js';

/** Prone press-up (extension in lying). Trunk inclination against gravity is the metric. */
export const pronePressUp: ExerciseDefinition = {
  id: 'prone-press-up',
  names: { es: 'Extensión en prono', en: 'Prone press-up' },
  synonyms: {
    es: ['extensión lumbar en prono', 'cobra', 'press up prono', 'extensión en decúbito prono'],
    en: ['prone press up', 'press up', 'cobra', 'extension in lying'],
  },
  area: 'lowerBack',
  position: 'prone',
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    trunk: { id: 'trunkInclination', side: 'auto' },
    elbow: { id: 'elbowFlexion', side: 'auto' },
  },
  primaryMetric: 'trunk',
  mode: 'reps',
  phases: [
    { id: 'rest', when: { above: 84 }, minDwellMs: 300 },
    { id: 'top', when: { below: 78 }, minDwellMs: 600 },
  ],
  targets: { direction: 'decrease', band: { min: 45, max: 70 }, safety: { min: 30, max: 100 } },
  rules: [
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 35 },
      sustainMs: 500,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 3, reps: 10, restSeconds: 40 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'prone',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: { hipAngle: 180, kneeAngle: 176, ankleAngle: 110, shoulderAbduction: 8 },
    keyframes: [
      { t: 0, pose: { trunkAngle: 0, shoulderAngle: 80, elbowAngle: 60 } },
      { t: 0.4, pose: { trunkAngle: -28, shoulderAngle: 60, elbowAngle: 165 } },
      { t: 0.6, pose: { trunkAngle: -28, shoulderAngle: 60, elbowAngle: 165 } },
      { t: 1, pose: { trunkAngle: 0, shoulderAngle: 80, elbowAngle: 60 } },
    ],
  },
};
