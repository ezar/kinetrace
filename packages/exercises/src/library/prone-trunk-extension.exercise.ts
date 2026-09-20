import type { ExerciseDefinition } from '../types.js';

/**
 * Prone trunk extension. The back lifts the trunk itself.
 *
 * The library's other prone extension is a press-up, where the arms do the
 * lifting and the back is along for the ride. That difference is the whole
 * exercise, so the arms stay beside the body here and the elbow is measured to
 * catch them joining in.
 */
export const proneTrunkExtension: ExerciseDefinition = {
  id: 'prone-trunk-extension',
  names: { es: 'Extensión de tronco en prono', en: 'Prone trunk extension' },
  synonyms: {
    es: [
      'extensión de tronco',
      'extensión lumbar activa',
      'elevación de tronco en prono',
      'superman',
    ],
    en: ['prone trunk extension', 'trunk extension', 'back extension', 'prone extension'],
  },
  howTo: {
    es: [
      'Túmbate boca abajo, con los brazos pegados al cuerpo.',
      'Despega el pecho del suelo usando la espalda, hasta alinear el tronco con las piernas.',
      'Baja despacio hasta apoyar el pecho otra vez.',
      'Los brazos no empujan y la cabeza sigue la línea de la espalda: la mirada va al suelo.',
    ],
    en: [
      'Lie face down, arms resting alongside your body.',
      'Lift your chest off the floor using your back, until your trunk lines up with your legs.',
      'Lower slowly until your chest is resting again.',
      'Your arms do not push, and your head follows the line of your back: keep looking down.',
    ],
  },
  area: 'lowerBack',
  position: 'prone',
  spinalLoad: 'extension',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    trunk: { id: 'trunkInclination', side: 'auto' },
    shoulder: { id: 'shoulderFlexion', side: 'auto' },
  },
  primaryMetric: 'trunk',
  mode: 'reps',
  phases: [
    { id: 'rest', when: { above: 86 }, minDwellMs: 300 },
    { id: 'top', when: { below: 82 }, minDwellMs: 600 },
  ],
  targets: { direction: 'decrease', band: { min: 66, max: 80 }, safety: { min: 50, max: 100 } },
  rules: [
    {
      // Half again the 11 deg/s the reference motion peaks at, held a quarter
      // of a second. The ceiling here is low and it is the filter's, not the
      // body's: the trunk only travels 16 degrees, and the engine estimates
      // velocity through a one-euro derivative, so even a repetition thrown at
      // five times the reference pace only reads 28 deg/s. A threshold much
      // above this one is a rule that can never fire, which is worse than no
      // rule. The reference motion never passes 12, so the gap is wide.
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 18 },
      sustainMs: 250,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
    {
      // Watching the shoulder, not the elbow. With the arms resting straight
      // alongside the body the elbow is already open, so an open elbow says
      // nothing; what a press-up needs first is the hands brought up beside
      // the chest, and that is the shoulder coming forward.
      //
      // The reference rests the arms 26 degrees off the trunk rather than flat
      // against it. That is how they are drawn as well as how they are
      // measured: in line with the trunk the two lines land on top of each
      // other and the figure reads as a hook rather than a person.
      id: 'armsPushing',
      priority: 'form',
      when: { metric: 'shoulder', above: 55 },
      sustainMs: 700,
      cooldownMs: 10000,
      cueKey: 'cue.dontPushWithArms',
    },
  ],
  defaults: { sets: 2, reps: 10, restSeconds: 40 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'prone',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: { hipAngle: 180, kneeAngle: 176, ankleAngle: 110, shoulderAbduction: 6 },
    keyframes: [
      { t: 0, pose: { trunkAngle: 0, shoulderAngle: 26, elbowAngle: 172 } },
      { t: 0.4, pose: { trunkAngle: -16, shoulderAngle: 26, elbowAngle: 172 } },
      { t: 0.6, pose: { trunkAngle: -16, shoulderAngle: 26, elbowAngle: 172 } },
      { t: 1, pose: { trunkAngle: 0, shoulderAngle: 26, elbowAngle: 172 } },
    ],
  },
};
