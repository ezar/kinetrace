import type { ExerciseDefinition } from '../types.js';

/**
 * Both knees to the chest, lifted by the hip flexors rather than pulled.
 *
 * The library's `double-knee-to-chest` is the stretch: the arms hug the knees
 * and hold the position. This is the work — the same end position reached and
 * left under the legs' own power, counted in repetitions — so the hands stay
 * on the floor, and that is what the rule watches for.
 */
export const activeDoubleKneeRaise: ExerciseDefinition = {
  id: 'active-double-knee-raise',
  names: { es: 'Rodillas al pecho activo', en: 'Active double knee raise' },
  synonyms: {
    es: [
      'abdominales inferiores',
      'elevación de rodillas tumbado',
      'rodillas al pecho sin manos',
      'flexión de cadera bilateral',
    ],
    en: [
      'lower abdominals',
      'active knee raise',
      'double knee raise',
      'knees to chest without hands',
    ],
  },
  howTo: {
    es: [
      'Túmbate boca arriba con las rodillas dobladas y las manos apoyadas en el suelo.',
      'Lleva las dos rodillas hacia el pecho usando las piernas, sin tirar con las manos.',
      'Bájalas despacio hasta volver al punto de partida.',
      'La espalda y la cabeza se quedan apoyadas todo el rato.',
    ],
    en: [
      'Lie on your back with your knees bent and your hands resting on the floor.',
      'Bring both knees towards your chest using your legs, without pulling with your hands.',
      'Lower them slowly back to the start.',
      'Your back and your head stay resting on the floor throughout.',
    ],
  },
  area: 'core',
  position: 'supine',
  spinalLoad: 'flexion',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'mean' },
    trunk: { id: 'trunkInclination', side: 'auto' },
  },
  primaryMetric: 'hip',
  mode: 'reps',
  phases: [
    { id: 'rest', when: { above: 118 }, minDwellMs: 300 },
    { id: 'top', when: { below: 82 }, minDwellMs: 500 },
  ],
  // The band has to sit clear of the `top` threshold above, or every counted
  // repetition is a good one by construction and the band says nothing.
  targets: { direction: 'decrease', band: { min: 55, max: 78 }, safety: { min: 30, max: 190 } },
  rules: [
    {
      // Half again the 47 deg/s the reference motion peaks at, held a quarter
      // of a second.
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 70 },
      sustainMs: 250,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
    {
      // The trunk curling up with the knees is the upper abdominals taking over
      // from the hip flexors. This exercise is the legs' work, and the back and
      // head stay down.
      id: 'trunkLifting',
      priority: 'form',
      when: { metric: 'trunk', below: 82 },
      sustainMs: 700,
      cooldownMs: 10000,
      cueKey: 'cue.restYourHeadDown',
    },
  ],
  defaults: { sets: 2, reps: 10, restSeconds: 40 },
  trackingConfidence: 'high',
  reference: {
    posture: 'supine',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: { shoulderAngle: 14, elbowAngle: 170, trunkAngle: 0 },
    keyframes: [
      {
        t: 0,
        pose: { left: { hipAngle: 128, kneeAngle: 88 }, right: { hipAngle: 128, kneeAngle: 88 } },
      },
      {
        t: 0.4,
        pose: { left: { hipAngle: 68, kneeAngle: 60 }, right: { hipAngle: 68, kneeAngle: 60 } },
      },
      {
        t: 0.65,
        pose: { left: { hipAngle: 68, kneeAngle: 60 }, right: { hipAngle: 68, kneeAngle: 60 } },
      },
      {
        t: 1,
        pose: { left: { hipAngle: 128, kneeAngle: 88 }, right: { hipAngle: 128, kneeAngle: 88 } },
      },
    ],
  },
};
