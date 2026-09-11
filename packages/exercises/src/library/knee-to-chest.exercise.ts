import type { ExerciseDefinition } from '../types.js';

/** Single knee to chest. A supine hip flexion stretch, counted as repetitions. */
export const kneeToChest: ExerciseDefinition = {
  id: 'knee-to-chest',
  names: { es: 'Rodilla al pecho', en: 'Knee to chest' },
  synonyms: {
    es: ['rodillas al pecho', 'flexión de cadera tumbado', 'rodilla al pecho unilateral'],
    en: ['knee to chest', 'single knee to chest', 'knee hug'],
  },
  area: 'lowerBack',
  position: 'supine',
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'auto' },
  },
  primaryMetric: 'hip',
  mode: 'reps',
  phases: [
    { id: 'rest', when: { above: 150 }, minDwellMs: 300 },
    { id: 'top', when: { below: 100 }, minDwellMs: 600 },
  ],
  targets: { direction: 'decrease', band: { min: 35, max: 75 }, safety: { min: 20, max: 190 } },
  rules: [
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 120 },
      sustainMs: 500,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 2, reps: 8, restSeconds: 30 },
  trackingConfidence: 'high',
  reference: {
    posture: 'supine',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: {
      shoulderAngle: 25,
      elbowAngle: 110,
      right: { hipAngle: 176, kneeAngle: 176 },
    },
    keyframes: [
      { t: 0, pose: { left: { hipAngle: 176, kneeAngle: 176 } } },
      { t: 0.4, pose: { left: { hipAngle: 60, kneeAngle: 55 } } },
      { t: 0.65, pose: { left: { hipAngle: 60, kneeAngle: 55 } } },
      { t: 1, pose: { left: { hipAngle: 176, kneeAngle: 176 } } },
    ],
  },
};
