import type { ExerciseDefinition } from '../types.js';

/**
 * Side-lying leg raise. The first exercise in the library measured by hip
 * abduction, which is why that metric exists.
 *
 * Nothing else here moves in the frontal plane, so nothing else needed it. The
 * camera watches from the front, which for a body on its side is the plane the
 * lift happens in; the figure is drawn from the front for the same reason.
 *
 * The drawing is the weakest part and it is not this exercise's fault: a body
 * on its side shows the width of its torso as well as its length, so the trunk
 * comes out as a closed box. The side planks have drawn that way since they
 * were added. What has to be legible is one leg leaving the other, and that
 * is; making the box into a person is a change to the figure for every
 * side-lying exercise rather than to this one.
 */
export const sideLyingLegRaise: ExerciseDefinition = {
  id: 'side-lying-leg-raise',
  names: { es: 'Elevación de pierna de lado', en: 'Side-lying leg raise' },
  synonyms: {
    es: [
      'elevación de pierna extendida',
      'abducción de cadera tumbado',
      'elevación lateral de pierna',
      'pierna arriba de lado',
    ],
    en: [
      'side lying leg raise',
      'side leg lift',
      'hip abduction lying',
      'straight leg raise on side',
    ],
  },
  howTo: {
    es: [
      'Túmbate de lado, con las dos piernas estiradas y una encima de la otra.',
      'Sube la pierna de arriba hacia el techo, manteniéndola recta.',
      'Bájala despacio hasta apoyarla sobre la otra.',
      'La pierna sube por el lado, no hacia delante: las caderas siguen una encima de otra.',
    ],
    en: [
      'Lie on your side, both legs straight and stacked.',
      'Lift the top leg towards the ceiling, keeping it straight.',
      'Lower it slowly until it rests on the other one.',
      'The leg goes out to the side, not forwards: keep your hips stacked.',
    ],
  },
  area: 'hips',
  position: 'sideLying',
  spinalLoad: 'neutral',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'front', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorFront',
  metrics: {
    hip: { id: 'hipAbduction', side: 'auto' },
    knee: { id: 'kneeFlexion', side: 'auto' },
  },
  primaryMetric: 'hip',
  mode: 'reps',
  unilateral: true,
  phases: [
    { id: 'rest', when: { below: 5 }, minDwellMs: 300 },
    { id: 'top', when: { above: 10 }, minDwellMs: 500 },
  ],
  // Degrees are the engine's unit and centimetres are the body's, so it is
  // worth writing the conversion down: on the body model's 0.86 m from hip to
  // ankle, ten degrees lifts the foot 15 cm, fifteen degrees 22 cm and twenty
  // degrees 29 cm. The band is a hand's width above the floor to a foot above
  // it, which is what this exercise is; the first threshold is low enough that
  // a small lift is still counted as a repetition and judged, rather than not
  // counted at all.
  targets: { direction: 'increase', band: { min: 14, max: 26 }, safety: { min: 0, max: 60 } },
  rules: [
    {
      // Half again the 11 deg/s the reference motion peaks at, held a quarter
      // of a second.
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 17 },
      sustainMs: 250,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
    {
      // The document asks for the leg extended, and a bending knee is the
      // cheapest way to get height without the hip doing the work.
      id: 'bentKnee',
      priority: 'form',
      when: { metric: 'knee', below: 155 },
      sustainMs: 700,
      cooldownMs: 10000,
      cueKey: 'cue.straightenLeg',
    },
  ],
  defaults: { sets: 2, reps: 10, restSeconds: 40 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'sideLyingLeft',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: {
      // Both arms lie in line with the trunk. Drawn from the front, a body on
      // its side has its arms along the axis the projection discards, so they
      // collapse onto the trunk whatever they are doing — there is no arm
      // position that would read here, and the one thing that has to read is
      // one leg leaving the other.
      left: { shoulderAngle: 10, elbowAngle: 170, hipAngle: 176, kneeAngle: 176 },
      right: { shoulderAngle: 10, elbowAngle: 170, hipAngle: 176, kneeAngle: 176 },
      trunkAngle: 0,
    },
    keyframes: [
      { t: 0, pose: { right: { hipAbduction: 2 } } },
      { t: 0.4, pose: { right: { hipAbduction: 17 } } },
      { t: 0.6, pose: { right: { hipAbduction: 17 } } },
      { t: 1, pose: { right: { hipAbduction: 2 } } },
    ],
  },
};
