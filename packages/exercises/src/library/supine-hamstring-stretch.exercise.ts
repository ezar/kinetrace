import type { ExerciseDefinition } from '../types.js';

/**
 * One leg raised straight from lying, and held. The knee angle is watched as
 * well as the hip: a leg that bends is a stretch that has moved somewhere else.
 */
export const supineHamstringStretch: ExerciseDefinition = {
  id: 'supine-hamstring-stretch',
  names: { es: 'Estiramiento isquiotibial tumbado', en: 'Supine hamstring stretch' },
  synonyms: {
    es: ['estiramiento de isquiotibiales', 'isquios', 'pierna estirada tumbado'],
    en: ['hamstring stretch', 'supine leg raise stretch', 'straight leg raise hold'],
  },
  howTo: {
    es: [
      'Túmbate boca arriba con una pierna estirada en el suelo.',
      'Sube la otra pierna recta, ayudándote con las manos por detrás del muslo.',
      'Súbela hasta notar tensión detrás, no dolor, y ahí te quedas.',
      'La rodilla de arriba se queda estirada y la espalda apoyada.',
    ],
    en: [
      'Lie on your back with one leg straight along the floor.',
      'Raise the other leg straight, holding behind the thigh with your hands.',
      'Take it up until you feel tension behind it, not pain, and stay there.',
      'The raised knee stays straight and your back stays down.',
    ],
  },
  area: 'hips',
  position: 'supine',
  spinalLoad: 'neutral',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'auto' },
    knee: { id: 'kneeFlexion', side: 'auto' },
  },
  primaryMetric: 'hip',
  mode: 'hold',
  unilateral: true,
  phases: [{ id: 'hold', when: { always: true }, minDwellMs: 0 }],
  /**
   * No safety stop. What makes a held stretch unsafe is how it feels, not an
   * angle a camera can police, and a range that can never fire is the defect
   * ADR 5 found in two exercises rather than a precaution.
   */
  // Reference motion measures 95 deg; only the maximum binds on `decrease`.
  targets: { direction: 'decrease', band: { min: 45, max: 100 } },
  hold: { stabilityToleranceDeg: 5 },
  rules: [
    {
      id: 'bentKnee',
      priority: 'form',
      when: { metric: 'knee', below: 160 },
      sustainMs: 1200,
      cooldownMs: 10000,
      cueKey: 'cue.straightenLeg',
    },
    {
      id: 'settle',
      priority: 'form',
      when: { signal: 'stability', above: 6 },
      sustainMs: 1500,
      cooldownMs: 10000,
      cueKey: 'cue.holdStill',
    },
  ],
  defaults: { sets: 2, holdSeconds: 30, restSeconds: 20 },
  trackingConfidence: 'high',
  reference: {
    posture: 'supine',
    // The worked leg is the one nearer the camera, so `auto` resolves to it —
    // the same arrangement `knee-to-chest` uses for the same reason.
    cameraSide: 'left',
    cycleSeconds: 4,
    base: {
      right: { hipAngle: 178, kneeAngle: 176 },
      shoulderAngle: 20,
      elbowAngle: 120,
    },
    keyframes: [{ t: 0, pose: { left: { hipAngle: 95, kneeAngle: 174 } } }],
  },
};
