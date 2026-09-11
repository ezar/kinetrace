import type { ExerciseDefinition } from '../types.js';

/** Thoracic rotation in quadruped ("open book" on all fours), seen from the front. */
export const thoracicRotationQuadruped: ExerciseDefinition = {
  id: 'thoracic-rotation-quadruped',
  names: { es: 'Rotación torácica en cuadrupedia', en: 'Quadruped thoracic rotation' },
  synonyms: {
    es: ['rotación torácica', 'apertura torácica', 'thread the needle', 'rotación dorsal'],
    en: ['thoracic rotation', 'open book', 'thread the needle', 'quadruped rotation'],
  },
  area: 'thoracic',
  position: 'quadruped',
  equipment: 'mat',
  view: { orientation: 'front', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorFront',
  metrics: {
    rotation: { id: 'thoracicRotation', side: 'auto', absolute: true },
    rotationSigned: { id: 'thoracicRotation', side: 'auto' },
  },
  primaryMetric: 'rotation',
  mode: 'reps',
  phases: [
    { id: 'neutral', when: { below: 15 }, minDwellMs: 300 },
    { id: 'rotated', when: { above: 30 }, minDwellMs: 500 },
  ],
  targets: { direction: 'increase', band: { min: 45, max: 90 }, safety: { min: 0, max: 100 } },
  rules: [
    {
      id: 'reachFurther',
      priority: 'encouragement',
      when: { all: [{ above: 30 }, { below: 45 }] },
      phases: ['rotated'],
      sustainMs: 900,
      cooldownMs: 12000,
      cueKey: 'cue.turnMore',
    },
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 60 },
      sustainMs: 500,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 2, reps: 8, restSeconds: 30 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'quadruped',
    cycleSeconds: 5,
    base: {
      hipAngle: 90,
      kneeAngle: 90,
      right: { shoulderAngle: 90, elbowAngle: 176 },
      left: { shoulderAngle: 90, elbowAngle: 100 },
    },
    keyframes: [
      { t: 0, pose: { trunkRotation: 0 } },
      { t: 0.45, pose: { trunkRotation: 55 } },
      { t: 0.6, pose: { trunkRotation: 55 } },
      { t: 1, pose: { trunkRotation: 0 } },
    ],
  },
};
