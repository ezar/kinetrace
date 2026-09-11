import type { ExerciseDefinition } from '../types.js';

/** Bird dog. Opposite arm and leg extend from quadruped without the pelvis rolling. */
export const birdDog: ExerciseDefinition = {
  id: 'bird-dog',
  names: { es: 'Perro de muestra', en: 'Bird dog' },
  synonyms: {
    es: ['bird dog', 'perro pájaro', 'cuadrupedia brazo y pierna'],
    en: ['bird dog', 'birddog', 'quadruped arm and leg raise'],
  },
  area: 'lowerBack',
  position: 'quadruped',
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'auto' },
    hipLevel: { id: 'hipLevelDifference', side: 'auto', absolute: true },
    spine: { id: 'spineFlexion', side: 'auto' },
  },
  primaryMetric: 'hip',
  mode: 'reps',
  phases: [
    { id: 'rest', when: { below: 110 }, minDwellMs: 300 },
    { id: 'extended', when: { above: 135 }, minDwellMs: 500 },
  ],
  targets: {
    direction: 'increase',
    band: { min: 160, max: 185 },
    safety: { min: 60, max: 200 },
  },
  rules: [
    {
      id: 'pelvisRolling',
      priority: 'form',
      when: { metric: 'hipLevel', above: 12 },
      sustainMs: 800,
      cooldownMs: 5000,
      cueKey: 'cue.keepHipsLevel',
    },
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 80 },
      sustainMs: 400,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 3, reps: 8, restSeconds: 45 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'quadruped',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: {
      trunkAngle: 0,
      shoulderAngle: 90,
      elbowAngle: 176,
      right: { hipAngle: 90, kneeAngle: 90 },
      left: { hipAngle: 90, kneeAngle: 90 },
    },
    keyframes: [
      { t: 0, pose: { left: { hipAngle: 90, kneeAngle: 90 } } },
      { t: 0.45, pose: { left: { hipAngle: 172, kneeAngle: 172 } } },
      { t: 0.6, pose: { left: { hipAngle: 172, kneeAngle: 172 } } },
      { t: 1, pose: { left: { hipAngle: 90, kneeAngle: 90 } } },
    ],
  },
};
