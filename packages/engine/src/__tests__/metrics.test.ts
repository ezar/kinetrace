import { describe, expect, it } from 'vitest';
import { MetricEvaluator } from '../metrics/evaluator.js';
import { POSTURES, poseToWorldPoints, resolvePose, type BodyPoseInput } from '../synth/body.js';
import { synthesizeFrames, type ReferenceMotion } from '../synth/motion.js';
import type { MetricSpec } from '../metrics/evaluator.js';
import { POSE_LANDMARK } from '../pose/landmarks.js';
import type { PoseFrame } from '../types.js';

/** One still frame of a pose, evaluated through the real pipeline. */
function measure(
  pose: BodyPoseInput,
  posture: keyof typeof POSTURES,
  metrics: Record<string, MetricSpec>,
  view: 'side' | 'front' = 'side',
): Record<string, number> {
  const motion: ReferenceMotion = {
    posture,
    cameraSide: 'left',
    cycleSeconds: 1,
    keyframes: [{ t: 0, pose }],
  };
  const frames = synthesizeFrames(motion, { view, fps: 30, holdAtPhase: 0, holdSeconds: 1.5 });
  const evaluator = new MetricEvaluator(metrics, { view });
  let last: Record<string, number> = {};
  for (const frame of frames) {
    const result = evaluator.update(frame);
    last = Object.fromEntries(
      Object.entries(result.samples).map(([name, sample]) => [name, sample.value]),
    );
  }
  return last;
}

describe('joint angle metrics', () => {
  // The shoulder line is wider than the pelvis, so on a real body the
  // shoulder-hip-knee angle is a few degrees short of 180 even when standing
  // perfectly straight. The library thresholds are authored against these
  // values, not against an idealised stick figure.
  it('reads close to 180 degrees for a straight standing body', () => {
    const values = measure({ hipAngle: 180, kneeAngle: 180, hipAbduction: 0 }, 'standing', {
      hip: { id: 'hipFlexion', side: 'left' },
      knee: { id: 'kneeFlexion', side: 'left' },
    });
    expect(values.hip).toBeGreaterThan(172);
    expect(values.knee).toBeCloseTo(180, 0);
  });

  it('follows the hip and knee through a squat position', () => {
    const values = measure({ hipAngle: 95, kneeAngle: 85, hipAbduction: 0 }, 'standing', {
      hip: { id: 'hipFlexion', side: 'left' },
      knee: { id: 'kneeFlexion', side: 'left' },
    });
    expect(values.hip).toBeGreaterThan(89);
    expect(values.hip).toBeLessThan(96);
    expect(values.knee).toBeCloseTo(85, 0);
  });

  it('measures trunk inclination against gravity in every posture', () => {
    const upright = measure({}, 'standing', { trunk: { id: 'trunkInclination', side: 'auto' } });
    const supine = measure({}, 'supine', { trunk: { id: 'trunkInclination', side: 'auto' } });
    const curled = measure({ trunkAngle: 18 }, 'supine', {
      trunk: { id: 'trunkInclination', side: 'auto' },
    });
    expect(upright.trunk).toBeCloseTo(0, 0);
    expect(supine.trunk).toBeCloseTo(90, 0);
    expect(curled.trunk).toBeCloseTo(72, 0);
  });
});

describe('hip abduction', () => {
  const metrics: Record<string, MetricSpec> = { hip: { id: 'hipAbduction', side: 'left' } };

  it('reads near zero for a leg in line with the trunk', () => {
    const values = measure(
      { hipAbduction: 0, hipAngle: 180, kneeAngle: 180 },
      'standing',
      metrics,
      'front',
    );
    expect(values.hip).toBeCloseTo(0, 0);
  });

  it('follows the femur out to the side, degree for degree', () => {
    for (const abduction of [15, 30, 45]) {
      const values = measure(
        { hipAbduction: abduction, hipAngle: 180, kneeAngle: 180 },
        'standing',
        metrics,
        'front',
      );
      expect(values.hip, `${abduction} deg`).toBeCloseTo(abduction, 0);
    }
  });

  /**
   * Measured against the trunk's own axis rather than the same-side
   * shoulder-to-hip diagonal, which leans in by however much wider a person's
   * shoulders are than their pelvis. On this metric's forty-five degree range
   * that lean would be a person-dependent offset of several degrees, so both
   * sides read the same number for the same movement whoever is doing it.
   */
  it('gives both legs the same reading for the same angle', () => {
    const values = measure(
      { hipAbduction: 30 },
      'standing',
      {
        left: { id: 'hipAbduction', side: 'left' },
        right: { id: 'hipAbduction', side: 'right' },
      },
      'front',
    );
    expect(values.left).toBeCloseTo(values.right ?? 0, 0);
    expect(values.left).toBeCloseTo(30, 0);
  });

  /**
   * The reason this metric exists. A side-lying leg raise is abduction, and
   * the body it happens to is rotated ninety degrees: the measurement has to
   * come out the same, because it is taken against the trunk rather than
   * against gravity.
   */
  it('reads the same lying on one side as it does standing', () => {
    const standing = measure({ hipAbduction: 35 }, 'standing', metrics, 'front');
    const lying = measure({ hipAbduction: 35 }, 'sideLyingLeft', metrics, 'front');
    expect(lying.hip).toBeCloseTo(standing.hip ?? 0, 0);
    expect(lying.hip).toBeCloseTo(35, 0);
  });

  /** Unsigned, like the shoulder: crossing the midline reads as a lift. */
  it('does not distinguish abduction from adduction', () => {
    const out = measure({ hipAbduction: 25 }, 'standing', metrics, 'front');
    const across = measure({ hipAbduction: -25 }, 'standing', metrics, 'front');
    expect(out.hip).toBeCloseTo(across.hip ?? 0, 0);
  });

  it('is not confused by the hip flexing at the same time', () => {
    const values = measure({ hipAbduction: 30, hipAngle: 130 }, 'standing', metrics, 'front');
    expect(values.hip).toBeGreaterThan(24);
    expect(values.hip).toBeLessThan(36);
  });
});

describe('trunkLineDeviation', () => {
  const metrics: Record<string, MetricSpec> = { line: { id: 'trunkLineDeviation', side: 'auto' } };

  it('is zero for a straight plank', () => {
    const values = measure({ hipAngle: 180, shoulderAngle: 90, elbowAngle: 90 }, 'prone', metrics);
    expect(Math.abs(values.line ?? 99)).toBeLessThan(1.5);
  });

  it('is positive when the hips hang below the line', () => {
    const values = measure({ hipAngle: 205, shoulderAngle: 90, elbowAngle: 90 }, 'prone', metrics);
    expect(values.line).toBeGreaterThan(12);
  });

  it('is negative when the hips are piked above the line', () => {
    const values = measure({ hipAngle: 155, shoulderAngle: 90, elbowAngle: 90 }, 'prone', metrics);
    expect(values.line).toBeLessThan(-12);
  });

  it('measures to the knees when the distal option says so', () => {
    const pose = { hipAngle: 180, kneeAngle: 110, shoulderAngle: 90, elbowAngle: 90 };
    const toKnee = measure(pose, 'prone', {
      line: { id: 'trunkLineDeviation', side: 'auto', options: { distal: 'knee' } },
    });
    expect(Math.abs(toKnee.line ?? 99)).toBeLessThan(2);
  });
});

describe('knee valgus', () => {
  it('is near zero when the knee tracks over the foot', () => {
    const values = measure(
      { hipAngle: 95, kneeAngle: 85, hipAbduction: 0 },
      'standing',
      {
        valgus: { id: 'kneeValgus', side: 'left' },
      },
      'front',
    );
    expect(Math.abs(values.valgus ?? 99)).toBeLessThan(2);
  });

  it('is positive when the knee falls inwards', () => {
    const values = measure(
      { hipAngle: 95, kneeAngle: 85, hipAbduction: 0, kneeSplay: 30 },
      'standing',
      {
        valgus: { id: 'kneeValgus', side: 'left' },
      },
      'front',
    );
    expect(values.valgus).toBeGreaterThan(8);
  });
});

describe('thoracic rotation and hip level', () => {
  it('reads the shoulder line against the hip line', () => {
    const neutral = measure(
      {},
      'quadruped',
      {
        rotation: { id: 'thoracicRotation', side: 'auto' },
      },
      'front',
    );
    const rotated = measure(
      { trunkRotation: 40 },
      'quadruped',
      {
        rotation: { id: 'thoracicRotation', side: 'auto' },
      },
      'front',
    );
    expect(Math.abs(neutral.rotation ?? 99)).toBeLessThan(2);
    expect(rotated.rotation).toBeCloseTo(40, -1);
  });

  it('detects a rolling pelvis as a hip level difference', () => {
    const level = measure(
      {},
      'quadruped',
      {
        hips: { id: 'hipLevelDifference', side: 'auto', absolute: true },
      },
      'front',
    );
    const rolled = measure(
      { pelvisRotation: 28 },
      'quadruped',
      {
        hips: { id: 'hipLevelDifference', side: 'auto', absolute: true },
      },
      'front',
    );
    expect(level.hips).toBeLessThan(2);
    expect(rolled.hips).toBeGreaterThan(12);
  });
});

describe('side selection', () => {
  /**
   * `auto` picks the side the camera sees better, and several metrics need the
   * whole torso as well because the anatomical frame is built from all four
   * points. Those four are identical in both sides' lists, so comparing the
   * lists whole is mostly a comparison of points that cannot discriminate: it
   * left less than the hysteresis between the near arm and the far one, and the
   * slot stayed on whichever side it happened to start.
   */
  it('measures the arm the camera can see, not the one behind the trunk', () => {
    // One arm by the side, the other raised: the two read far apart, so the
    // value says which one was measured.
    const motion: ReferenceMotion = {
      posture: 'standing',
      cameraSide: 'left',
      cycleSeconds: 1,
      keyframes: [{ t: 0, pose: { left: { shoulderAngle: 10 }, right: { shoulderAngle: 150 } } }],
    };
    const frames = synthesizeFrames(motion, {
      view: 'side',
      fps: 30,
      holdAtPhase: 0,
      holdSeconds: 1.5,
    });

    // A body seen from its right: the left elbow is partly behind the trunk,
    // the torso equally visible whichever side you ask about. The margin is
    // the point. Averaged over the whole list — three of whose five points are
    // shared torso — the two sides come out 0.07 apart, inside the 0.08 the
    // evaluator needs before it will switch, so the slot stays where it
    // started. Compared on the elbows alone they are 0.35 apart.
    const occluded = frames.map((frame) => ({
      ...frame,
      image: frame.image.map((landmark, index) =>
        index === POSE_LANDMARK.LEFT_ELBOW || index === POSE_LANDMARK.LEFT_WRIST
          ? { ...landmark, visibility: 0.65 }
          : { ...landmark, visibility: 1 },
      ),
    }));

    const evaluator = new MetricEvaluator(
      { arm: { id: 'shoulderFlexion', side: 'auto' } },
      { view: 'side' },
    );
    let value = Number.NaN;
    for (const frame of occluded) value = evaluator.update(frame).samples.arm?.value ?? Number.NaN;
    expect(value).toBeGreaterThan(100);
  });

  /**
   * And the shoulder and the hip are side-specific too, even though the torso
   * they belong to is needed whole. Deciding on the elbow alone — which is
   * what dropping every shared landmark leaves — picks the arm whose elbow
   * happens to be clearest, however hidden the rest of it is.
   */
  it('weighs the whole limb, not just its far end', () => {
    const motion: ReferenceMotion = {
      posture: 'standing',
      cameraSide: 'left',
      cycleSeconds: 1,
      keyframes: [{ t: 0, pose: { left: { shoulderAngle: 10 }, right: { shoulderAngle: 150 } } }],
    };
    const frames = synthesizeFrames(motion, {
      view: 'side',
      fps: 30,
      holdAtPhase: 0,
      holdSeconds: 1.5,
    });

    // The left shoulder and hip are well hidden and its elbow happens to be
    // crisp; the right arm is visible throughout, with a slightly softer elbow.
    const visibility = new Map<number, number>([
      [POSE_LANDMARK.LEFT_SHOULDER, 0.3],
      [POSE_LANDMARK.LEFT_HIP, 0.3],
      [POSE_LANDMARK.LEFT_ELBOW, 1],
      [POSE_LANDMARK.RIGHT_ELBOW, 0.9],
    ]);
    const occluded = frames.map((frame) => ({
      ...frame,
      image: frame.image.map((landmark, index) => ({
        ...landmark,
        visibility: visibility.get(index) ?? 1,
      })),
    }));

    const evaluator = new MetricEvaluator(
      { arm: { id: 'shoulderFlexion', side: 'auto' } },
      { view: 'side' },
    );
    let value = Number.NaN;
    for (const frame of occluded) value = evaluator.update(frame).samples.arm?.value ?? Number.NaN;
    expect(value).toBeGreaterThan(100);
  });
});

describe('space selection', () => {
  it('falls back to image landmarks and lowers confidence when visibility drops', () => {
    const motion: ReferenceMotion = {
      posture: 'standing',
      cameraSide: 'left',
      cycleSeconds: 1,
      keyframes: [{ t: 0, pose: { hipAngle: 120, kneeAngle: 120 } }],
    };
    const frames = synthesizeFrames(motion, {
      view: 'side',
      fps: 30,
      holdAtPhase: 0,
      holdSeconds: 1,
      visibilityScale: 0.5,
    });
    const evaluator = new MetricEvaluator(
      { hip: { id: 'hipFlexion', side: 'left' } },
      { view: 'side' },
    );
    let sample = evaluator.update(frames[0] as PoseFrame).samples.hip;
    for (const frame of frames) sample = evaluator.update(frame).samples.hip;
    expect(sample?.fromImageSpace).toBe(true);
    expect(sample?.confidence).toBeLessThan(0.5);
  });
});

describe('body model', () => {
  it('places the hip midpoint at the origin of world landmarks', () => {
    const points = poseToWorldPoints(resolvePose({}), POSTURES.standing);
    const leftHip = points[23];
    const rightHip = points[24];
    expect((leftHip!.x + rightHip!.x) / 2).toBeCloseTo(0);
    expect((leftHip!.y + rightHip!.y) / 2).toBeCloseTo(0);
  });

  it('puts the head above the hips when standing and beside them when supine', () => {
    const standing = poseToWorldPoints(resolvePose({}), POSTURES.standing);
    const supine = poseToWorldPoints(resolvePose({}), POSTURES.supine);
    expect(standing[0]!.y).toBeGreaterThan(0.5);
    expect(Math.abs(supine[0]!.y)).toBeLessThan(0.2);
  });
});
