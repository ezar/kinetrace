import type { ExerciseDefinition } from '../types.js';

/** Bodyweight squat. Knee flexion from the side, with a valgus watch on the knees. */
export const bodyweightSquat: ExerciseDefinition = {
  id: 'bodyweight-squat',
  names: { es: 'Sentadilla con peso corporal', en: 'Bodyweight squat' },
  synonyms: {
    es: ['sentadilla', 'sentadillas', 'squat', 'sentadilla libre'],
    en: ['squat', 'bodyweight squat', 'air squat'],
  },
  area: 'hips',
  position: 'standing',
  equipment: 'none',
  view: { orientation: 'side', cameraHeight: 'chair', distanceMetres: 3 },
  cameraTipKey: 'tip.chairSide',
  metrics: {
    knee: { id: 'kneeFlexion', side: 'auto' },
    trunk: { id: 'trunkInclination', side: 'auto' },
    valgus: { id: 'kneeValgus', side: 'auto' },
  },
  primaryMetric: 'knee',
  mode: 'reps',
  phases: [
    { id: 'stand', when: { above: 160 }, minDwellMs: 250 },
    { id: 'bottom', when: { below: 120 }, minDwellMs: 300 },
  ],
  targets: { direction: 'decrease', band: { min: 70, max: 100 }, safety: { min: 45, max: 190 } },
  rules: [
    {
      id: 'kneeValgus',
      priority: 'safety',
      when: { metric: 'valgus', above: 10 },
      sustainMs: 500,
      cooldownMs: 6000,
      cueKey: 'cue.kneesOut',
    },
    {
      id: 'trunkForward',
      priority: 'form',
      when: { metric: 'trunk', above: 55 },
      sustainMs: 700,
      cooldownMs: 6000,
      cueKey: 'cue.chestUp',
    },
  ],
  defaults: { sets: 3, reps: 12, restSeconds: 60 },
  trackingConfidence: 'high',
  reference: {
    posture: 'standing',
    cameraSide: 'left',
    cycleSeconds: 4,
    base: { shoulderAngle: 20, elbowAngle: 170, hipAbduction: 6 },
    keyframes: [
      { t: 0, pose: { hipAngle: 176, kneeAngle: 176, trunkAngle: 0, ankleAngle: 90 } },
      { t: 0.45, pose: { hipAngle: 95, kneeAngle: 85, trunkAngle: 35, ankleAngle: 70 } },
      { t: 0.6, pose: { hipAngle: 95, kneeAngle: 85, trunkAngle: 35, ankleAngle: 70 } },
      { t: 1, pose: { hipAngle: 176, kneeAngle: 176, trunkAngle: 0, ankleAngle: 90 } },
    ],
  },
};
