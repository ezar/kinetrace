import type { ExerciseDefinition } from '../types.js';

/**
 * Front plank. An isometric: the engine times the hold and watches the line
 * from the shoulders to the ankles.
 */
export const frontPlank: ExerciseDefinition = {
  id: 'front-plank',
  names: { es: 'Plancha frontal', en: 'Front plank' },
  synonyms: {
    es: ['plancha', 'plancha abdominal', 'plancha isométrica'],
    en: ['plank', 'forearm plank', 'front hold'],
  },
  howTo: {
    es: [
      'Apóyate en los antebrazos y en las puntas de los pies, con los codos bajo los hombros.',
      'Sube las caderas hasta que la cabeza, la espalda y las piernas queden en línea.',
      'Mantén esa línea, sin que las caderas suban ni se hundan.',
    ],
    en: [
      'Rest on your forearms and your toes, elbows under your shoulders.',
      'Lift your hips until your head, back and legs are in one line.',
      'Hold that line, with your hips neither rising nor sagging.',
    ],
  },
  area: 'core',
  position: 'prone',
  spinalLoad: 'neutral',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    line: { id: 'trunkLineDeviation', side: 'auto' },
    trunk: { id: 'trunkInclination', side: 'auto' },
  },
  primaryMetric: 'line',
  mode: 'hold',
  phases: [{ id: 'hold', when: { always: true }, minDwellMs: 0 }],
  targets: {
    direction: 'decrease',
    band: { min: -8, max: 8 },
    safety: { min: -30, max: 30 },
  },
  hold: { stabilityToleranceDeg: 4 },
  rules: [
    {
      id: 'hipsSagging',
      priority: 'form',
      when: { metric: 'line', above: 12 },
      sustainMs: 1000,
      cooldownMs: 4000,
      cueKey: 'cue.liftHips',
    },
    {
      id: 'hipsPiked',
      priority: 'form',
      when: { metric: 'line', below: -12 },
      sustainMs: 1000,
      cooldownMs: 4000,
      cueKey: 'cue.lowerHips',
    },
    {
      id: 'pace',
      priority: 'form',
      when: { metric: 'trunk', signal: 'absVelocity', above: 20 },
      sustainMs: 300,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 3, holdSeconds: 30, restSeconds: 45 },
  trackingConfidence: 'high',
  reference: {
    posture: 'prone',
    cameraSide: 'left',
    cycleSeconds: 4,
    base: {
      shoulderAngle: 90,
      elbowAngle: 90,
      kneeAngle: 178,
      ankleAngle: 70,
      hipAbduction: 3,
      shoulderAbduction: 3,
    },
    keyframes: [{ t: 0, pose: { hipAngle: 180, trunkAngle: 0 } }],
  },
};
