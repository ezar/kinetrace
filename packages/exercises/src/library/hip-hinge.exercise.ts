import type { ExerciseDefinition } from '../types.js';

/** Hip hinge with a dowel. Standing, seen from the side. */
export const hipHinge: ExerciseDefinition = {
  id: 'hip-hinge',
  names: { es: 'Bisagra de cadera', en: 'Hip hinge' },
  synonyms: {
    es: ['bisagra de cadera con pica', 'hip hinge', 'peso muerto sin carga', 'bisagra'],
    en: ['hip hinge', 'dowel hip hinge', 'hinge with stick', 'good morning'],
  },
  area: 'hips',
  position: 'standing',
  equipment: 'none',
  view: { orientation: 'side', cameraHeight: 'chair', distanceMetres: 3 },
  cameraTipKey: 'tip.chairSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'auto' },
    knee: { id: 'kneeFlexion', side: 'auto' },
  },
  primaryMetric: 'hip',
  mode: 'reps',
  phases: [
    { id: 'stand', when: { above: 160 }, minDwellMs: 300 },
    { id: 'hinged', when: { below: 130 }, minDwellMs: 400 },
  ],
  targets: { direction: 'decrease', band: { min: 80, max: 110 }, safety: { min: 55, max: 190 } },
  rules: [
    {
      id: 'kneesBending',
      priority: 'form',
      when: { metric: 'knee', below: 140 },
      sustainMs: 700,
      cooldownMs: 6000,
      cueKey: 'cue.straightenKnees',
    },
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 95 },
      sustainMs: 400,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 3, reps: 10, restSeconds: 45 },
  trackingConfidence: 'high',
  reference: {
    posture: 'standing',
    cameraSide: 'left',
    cycleSeconds: 4,
    base: { shoulderAngle: 20, elbowAngle: 176, ankleAngle: 90 },
    keyframes: [
      { t: 0, pose: { hipAngle: 176, kneeAngle: 176, trunkAngle: 0 } },
      { t: 0.45, pose: { hipAngle: 95, kneeAngle: 160, trunkAngle: 72 } },
      { t: 0.6, pose: { hipAngle: 95, kneeAngle: 160, trunkAngle: 72 } },
      { t: 1, pose: { hipAngle: 176, kneeAngle: 176, trunkAngle: 0 } },
    ],
  },
};
