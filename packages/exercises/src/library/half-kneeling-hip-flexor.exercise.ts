import type { ExerciseDefinition } from '../types.js';

/**
 * Half kneeling hip flexor stretch. The back hip opens as the hips travel
 * forward; the trunk has to stay upright or the stretch goes somewhere else.
 *
 * What the camera can see, and what it cannot. `hipFlexion` is an interior
 * shoulder-hip-knee angle, so it reports 0 to 180 and cannot distinguish a hip
 * extended past neutral from one a few degrees short of it. The useful range —
 * from a hip still folded at 140 degrees to one open at 180 — is measured
 * perfectly well; only the last few degrees of true extension are invisible,
 * which is why the band's maximum is the metric's own ceiling and only the
 * minimum binds.
 */
export const halfKneelingHipFlexor: ExerciseDefinition = {
  id: 'half-kneeling-hip-flexor',
  names: { es: 'Estiramiento de psoas en rodilla', en: 'Half kneeling hip flexor stretch' },
  synonyms: {
    es: [
      'estiramiento de psoas',
      'psoas',
      'flexor de cadera',
      'zancada de rodillas',
      'estiramiento del iliopsoas',
    ],
    en: [
      'hip flexor stretch',
      'psoas stretch',
      'half kneeling lunge stretch',
      'iliopsoas stretch',
      'kneeling lunge',
    ],
  },
  howTo: {
    es: [
      'Apoya una rodilla en el suelo y pon el otro pie delante, con la rodilla sobre el tobillo.',
      'Mete la pelvis por debajo, como si escondieras el coxis, hasta notar tensión delante de la cadera de atrás.',
      'Lleva el peso un poco hacia delante sin sacar la rodilla de atrás del sitio.',
      'El tronco se queda vertical y la espalda no se arquea: si te inclinas, el estiramiento se va.',
    ],
    en: [
      'Put one knee on the floor and the other foot in front, knee over the ankle.',
      'Tuck your pelvis under, as if hiding your tailbone, until you feel tension at the front of the back hip.',
      'Shift your weight forward a little without moving the back knee.',
      'Your trunk stays upright and your back does not arch: if you lean, the stretch goes elsewhere.',
    ],
  },
  area: 'hips',
  position: 'kneeling',
  spinalLoad: 'neutral',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'auto' },
    trunk: { id: 'trunkInclination', side: 'auto' },
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
  targets: { direction: 'increase', band: { min: 160, max: 180 } },
  hold: { stabilityToleranceDeg: 5 },
  rules: [
    {
      id: 'leaning',
      priority: 'form',
      when: { metric: 'trunk', above: 18 },
      sustainMs: 1200,
      cooldownMs: 10000,
      cueKey: 'cue.chestUp',
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
  trackingConfidence: 'medium',
  reference: {
    // A half kneeling person is upright, so the body's world orientation is the
    // standing one; `position: 'kneeling'` is what the library filter says.
    posture: 'standing',
    // The stretched leg is the one nearer the camera, so `auto` resolves to it.
    cameraSide: 'left',
    cycleSeconds: 4,
    base: {
      shoulderAngle: 10,
      elbowAngle: 170,
      // Front leg: foot forward, knee over the ankle.
      right: { hipAngle: 95, kneeAngle: 90 },
    },
    keyframes: [
      {
        t: 0,
        // Back leg: thigh straight down so the knee lands under the hip, shin
        // folded back along the floor, and the foot carried on along the shin.
        // `ankleAngle` defaults to 90, which is a foot flat under a standing
        // shin — on a shin lying down it points the toes through the mat.
        pose: { left: { hipAngle: 176, kneeAngle: 88, ankleAngle: 172 } },
      },
    ],
  },
};
