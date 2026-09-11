import type { ExerciseDefinition } from '../types.js';

/** Child's pose. A held stretch measured as deep hip flexion in kneeling. */
export const childsPose: ExerciseDefinition = {
  id: 'childs-pose',
  names: { es: 'Postura del niño', en: "Child's pose" },
  synonyms: {
    es: ['postura del niño', 'plegaria mahometana', 'estiramiento del niño'],
    en: ["child's pose", 'childs pose', 'prayer stretch'],
  },
  area: 'lowerBack',
  position: 'quadruped',
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'auto' },
  },
  primaryMetric: 'hip',
  mode: 'hold',
  phases: [{ id: 'hold', when: { always: true }, minDwellMs: 0 }],
  targets: { direction: 'decrease', band: { min: 30, max: 62 }, safety: { min: 15, max: 120 } },
  hold: { stabilityToleranceDeg: 5 },
  rules: [
    {
      id: 'settle',
      priority: 'form',
      when: { signal: 'stability', above: 6 },
      sustainMs: 1500,
      cooldownMs: 10000,
      cueKey: 'cue.holdStill',
    },
  ],
  defaults: { sets: 2, holdSeconds: 30, restSeconds: 30 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'quadruped',
    cycleSeconds: 4,
    base: {
      shoulderAngle: 150,
      elbowAngle: 176,
      kneeAngle: 40,
      hipAbduction: 12,
    },
    keyframes: [{ t: 0, pose: { hipAngle: 45, trunkAngle: 0 } }],
  },
};
