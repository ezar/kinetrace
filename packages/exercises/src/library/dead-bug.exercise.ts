import type { ExerciseDefinition } from '../types.js';

/** Dead bug. One leg lowers from tabletop while the lower back stays down. */
export const deadBug: ExerciseDefinition = {
  id: 'dead-bug',
  names: { es: 'Bicho muerto', en: 'Dead bug' },
  synonyms: {
    es: ['dead bug', 'insecto muerto', 'cucaracha'],
    en: ['dead bug', 'deadbug'],
  },
  area: 'core',
  position: 'supine',
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'auto' },
    trunk: { id: 'trunkInclination', side: 'auto' },
  },
  primaryMetric: 'hip',
  mode: 'reps',
  phases: [
    { id: 'tabletop', when: { below: 105 }, minDwellMs: 300 },
    { id: 'extended', when: { above: 130 }, minDwellMs: 400 },
  ],
  targets: {
    direction: 'increase',
    band: { min: 150, max: 178 },
    safety: { min: 60, max: 190 },
  },
  rules: [
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 75 },
      sustainMs: 400,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
    {
      id: 'trunkLifting',
      priority: 'form',
      when: { metric: 'trunk', below: 82 },
      sustainMs: 800,
      cooldownMs: 6000,
      cueKey: 'cue.pressBackDown',
    },
  ],
  defaults: { sets: 3, reps: 10, restSeconds: 45 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'supine',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: {
      trunkAngle: 0,
      shoulderAngle: 90,
      elbowAngle: 175,
      right: { hipAngle: 90, kneeAngle: 90 },
    },
    keyframes: [
      { t: 0, pose: { left: { hipAngle: 90, kneeAngle: 90 } } },
      { t: 0.45, pose: { left: { hipAngle: 165, kneeAngle: 150 } } },
      { t: 0.6, pose: { left: { hipAngle: 165, kneeAngle: 150 } } },
      { t: 1, pose: { left: { hipAngle: 90, kneeAngle: 90 } } },
    ],
  },
};
