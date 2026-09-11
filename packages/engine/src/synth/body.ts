/**
 * Kinematic body model.
 *
 * Kinetrace needs skeletons without a camera in three places: the animated
 * demo in the exercise library, the fixtures the engine is tested against, and
 * the replay tool. All three come from this one model, so a movement authored
 * once in the exercise DSL is the same movement everywhere.
 *
 * Body frame: origin at the hip midpoint, +X to the subject's left, +Y towards
 * the head, +Z out of the chest. Sagittal directions are expressed as an angle
 * from +Y rotating towards +Z, so 0 deg points at the head and 90 deg forward.
 */

import type { Landmark, Vec3 } from '../types.js';
import { LANDMARK_COUNT, POSE_LANDMARK } from '../pose/landmarks.js';
import { add, DEG_TO_RAD, lerp, normalize, scale, subtract } from '../metrics/geometry.js';

/** Segment lengths in metres for a 1.75 m adult. Angles are what matter, so one build is enough. */
export interface BodyProportions {
  pelvisWidth: number;
  shoulderWidth: number;
  torsoLength: number;
  upperArm: number;
  forearm: number;
  thigh: number;
  shank: number;
  foot: number;
  head: number;
}

export const DEFAULT_PROPORTIONS: BodyProportions = {
  pelvisWidth: 0.3,
  shoulderWidth: 0.38,
  torsoLength: 0.5,
  upperArm: 0.3,
  forearm: 0.26,
  thigh: 0.44,
  shank: 0.42,
  foot: 0.22,
  head: 0.24,
};

/** Joint angles of one side of the body, in degrees. */
export interface LimbPose {
  /** Interior shoulder-hip-knee angle. 180 is a fully extended hip. */
  hipAngle: number;
  /** Interior hip-knee-ankle angle. 180 is a straight knee. */
  kneeAngle: number;
  /** Interior knee-ankle-foot angle. 90 is a neutral foot. */
  ankleAngle: number;
  /** Femur splay out of the sagittal plane. Positive moves the knee away from the midline. */
  hipAbduction: number;
  /**
   * Splay of the shank relative to the femur. Positive swings the ankle outwards,
   * which is what a knee collapsing inwards (valgus) looks like.
   */
  kneeSplay: number;
  /** Arm elevation in the sagittal plane. 0 is arm alongside the trunk, 180 overhead. */
  shoulderAngle: number;
  /** Arm splay out of the sagittal plane. Positive moves the elbow away from the midline. */
  shoulderAbduction: number;
  /** Interior shoulder-elbow-wrist angle. 180 is a straight arm. */
  elbowAngle: number;
}

/** A fully resolved pose: every joint of both sides. */
export interface BodyPose {
  /** Direction of the trunk in the sagittal plane, in degrees from the superior axis. */
  trunkAngle: number;
  /** Rotation of the shoulder line around the trunk axis. Positive turns towards the subject's left. */
  trunkRotation: number;
  /** Lateral bend of the trunk, in degrees. Positive bends towards the subject's left. */
  trunkLateral: number;
  /**
   * Rotation of the hip line around the trunk axis, in degrees. Positive turns
   * towards the subject's left. In quadruped and lying positions this is what a
   * rolling pelvis looks like to the camera.
   */
  pelvisRotation: number;
  /** Extra sagittal angle of the head relative to the trunk, in degrees. */
  headTilt: number;
  left: LimbPose;
  right: LimbPose;
}

/** Terse authoring form: scalars apply to both sides unless a side overrides them. */
export type BodyPoseInput = Partial<Omit<BodyPose, 'left' | 'right'>> &
  Partial<LimbPose> & {
    left?: Partial<LimbPose>;
    right?: Partial<LimbPose>;
  };

const NEUTRAL_LIMB: LimbPose = {
  hipAngle: 180,
  kneeAngle: 178,
  ankleAngle: 90,
  hipAbduction: 4,
  kneeSplay: 0,
  shoulderAngle: 8,
  shoulderAbduction: 6,
  elbowAngle: 172,
};

/** Anatomical neutral: standing upright, arms at the sides. */
export const NEUTRAL_POSE: BodyPose = {
  trunkAngle: 0,
  trunkRotation: 0,
  trunkLateral: 0,
  pelvisRotation: 0,
  headTilt: 0,
  left: { ...NEUTRAL_LIMB },
  right: { ...NEUTRAL_LIMB },
};

const LIMB_KEYS: readonly (keyof LimbPose)[] = [
  'hipAngle',
  'kneeAngle',
  'ankleAngle',
  'hipAbduction',
  'kneeSplay',
  'shoulderAngle',
  'shoulderAbduction',
  'elbowAngle',
];

/** Expand the terse authoring form into a fully resolved pose. */
export function resolvePose(input: BodyPoseInput, base: BodyPose = NEUTRAL_POSE): BodyPose {
  const resolveLimb = (side: 'left' | 'right'): LimbPose => {
    const limb: LimbPose = { ...base[side] };
    for (const key of LIMB_KEYS) {
      const shared = input[key];
      if (typeof shared === 'number') limb[key] = shared;
      const specific = input[side]?.[key];
      if (typeof specific === 'number') limb[key] = specific;
    }
    return limb;
  };
  return {
    trunkAngle: input.trunkAngle ?? base.trunkAngle,
    trunkRotation: input.trunkRotation ?? base.trunkRotation,
    trunkLateral: input.trunkLateral ?? base.trunkLateral,
    pelvisRotation: input.pelvisRotation ?? base.pelvisRotation,
    headTilt: input.headTilt ?? base.headTilt,
    left: resolveLimb('left'),
    right: resolveLimb('right'),
  };
}

export function lerpPose(a: BodyPose, b: BodyPose, t: number): BodyPose {
  const limb = (side: 'left' | 'right'): LimbPose => {
    const result = {} as LimbPose;
    for (const key of LIMB_KEYS) result[key] = lerp(a[side][key], b[side][key], t);
    return result;
  };
  return {
    trunkAngle: lerp(a.trunkAngle, b.trunkAngle, t),
    trunkRotation: lerp(a.trunkRotation, b.trunkRotation, t),
    trunkLateral: lerp(a.trunkLateral, b.trunkLateral, t),
    pelvisRotation: lerp(a.pelvisRotation, b.pelvisRotation, t),
    headTilt: lerp(a.headTilt, b.headTilt, t),
    left: limb('left'),
    right: limb('right'),
  };
}

/** Unit vector in the sagittal plane at `degrees` from the superior axis. */
function sagittal(degrees: number): Vec3 {
  const radians = degrees * DEG_TO_RAD;
  return { x: 0, y: Math.cos(radians), z: Math.sin(radians) };
}

/** Rotate `v` around the anterior axis (+Z), which splays limbs sideways. */
function splay(v: Vec3, degrees: number): Vec3 {
  const radians = degrees * DEG_TO_RAD;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos, z: v.z };
}

/** Rodrigues rotation of `v` around the unit vector `axis`. */
function rotateAround(v: Vec3, axis: Vec3, degrees: number): Vec3 {
  const radians = degrees * DEG_TO_RAD;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const k = normalize(axis);
  const dotKV = k.x * v.x + k.y * v.y + k.z * v.z;
  return {
    x: v.x * cos + (k.y * v.z - k.z * v.y) * sin + k.x * dotKV * (1 - cos),
    y: v.y * cos + (k.z * v.x - k.x * v.z) * sin + k.y * dotKV * (1 - cos),
    z: v.z * cos + (k.x * v.y - k.y * v.x) * sin + k.z * dotKV * (1 - cos),
  };
}

/** How the whole body is oriented against gravity. */
export interface Posture {
  /** Rotation around the world X axis, in degrees. -90 lies the subject on their back. */
  tiltXDeg: number;
  /** Rotation around the world Z axis, in degrees. +/-90 lies the subject on their side. */
  rollZDeg: number;
}

export type PostureName =
  'standing' | 'supine' | 'prone' | 'quadruped' | 'sideLyingLeft' | 'sideLyingRight';

export const POSTURES: Readonly<Record<PostureName, Posture>> = {
  standing: { tiltXDeg: 0, rollZDeg: 0 },
  supine: { tiltXDeg: -90, rollZDeg: 0 },
  prone: { tiltXDeg: 90, rollZDeg: 0 },
  quadruped: { tiltXDeg: 90, rollZDeg: 0 },
  sideLyingLeft: { tiltXDeg: 0, rollZDeg: -90 },
  sideLyingRight: { tiltXDeg: 0, rollZDeg: 90 },
};

function applyPosture(point: Vec3, posture: Posture): Vec3 {
  const tilt = posture.tiltXDeg * DEG_TO_RAD;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const tilted: Vec3 = {
    x: point.x,
    y: point.y * cosT - point.z * sinT,
    z: point.y * sinT + point.z * cosT,
  };
  const roll = posture.rollZDeg * DEG_TO_RAD;
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  return {
    x: tilted.x * cosR - tilted.y * sinR,
    y: tilted.x * sinR + tilted.y * cosR,
    z: tilted.z,
  };
}

/** The 33 landmark positions of a pose, in world metres, hip-centred and gravity-aligned. */
export function poseToWorldPoints(
  pose: BodyPose,
  posture: Posture,
  proportions: BodyProportions = DEFAULT_PROPORTIONS,
): Vec3[] {
  const p = proportions;
  const points: Vec3[] = new Array<Vec3>(LANDMARK_COUNT).fill({ x: 0, y: 0, z: 0 });
  const set = (index: number, value: Vec3): void => {
    points[index] = value;
  };

  const hipMid: Vec3 = { x: 0, y: 0, z: 0 };
  const trunkDirection = splay(sagittal(pose.trunkAngle), pose.trunkLateral);
  const shoulderMid = scale(trunkDirection, p.torsoLength);
  const lateral = rotateAround({ x: 1, y: 0, z: 0 }, trunkDirection, pose.trunkRotation);

  const pelvisAxis = rotateAround({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, pose.pelvisRotation);
  set(POSE_LANDMARK.LEFT_HIP, scale(pelvisAxis, p.pelvisWidth / 2));
  set(POSE_LANDMARK.RIGHT_HIP, scale(pelvisAxis, -p.pelvisWidth / 2));
  set(POSE_LANDMARK.LEFT_SHOULDER, add(shoulderMid, scale(lateral, p.shoulderWidth / 2)));
  set(POSE_LANDMARK.RIGHT_SHOULDER, add(shoulderMid, scale(lateral, -p.shoulderWidth / 2)));

  for (const side of ['left', 'right'] as const) {
    const limb = pose[side];
    const mirror = side === 'left' ? 1 : -1;
    const hip = points[side === 'left' ? POSE_LANDMARK.LEFT_HIP : POSE_LANDMARK.RIGHT_HIP] as Vec3;
    const shoulder = points[
      side === 'left' ? POSE_LANDMARK.LEFT_SHOULDER : POSE_LANDMARK.RIGHT_SHOULDER
    ] as Vec3;

    const femurAngle = pose.trunkAngle + limb.hipAngle;
    const femurDirection = splay(sagittal(femurAngle), limb.hipAbduction * mirror);
    const knee = add(hip, scale(femurDirection, p.thigh));

    const shankAngle = femurAngle + 180 - limb.kneeAngle;
    const shankDirection = splay(
      sagittal(shankAngle),
      (limb.hipAbduction + limb.kneeSplay) * mirror,
    );
    const ankle = add(knee, scale(shankDirection, p.shank));

    const footAngle = shankAngle - (180 - limb.ankleAngle);
    const footDirection = splay(sagittal(footAngle), (limb.hipAbduction + limb.kneeSplay) * mirror);
    const footIndex = add(ankle, scale(footDirection, p.foot));
    const heel = add(ankle, scale(footDirection, -0.06));

    const armAngle = pose.trunkAngle + 180 - limb.shoulderAngle;
    const armDirection = splay(sagittal(armAngle), limb.shoulderAbduction * mirror);
    const elbow = add(shoulder, scale(armDirection, p.upperArm));

    const forearmAngle = armAngle + 180 - limb.elbowAngle;
    const forearmDirection = splay(sagittal(forearmAngle), limb.shoulderAbduction * mirror);
    const wrist = add(elbow, scale(forearmDirection, p.forearm));
    const hand = add(wrist, scale(forearmDirection, 0.08));

    if (side === 'left') {
      set(POSE_LANDMARK.LEFT_KNEE, knee);
      set(POSE_LANDMARK.LEFT_ANKLE, ankle);
      set(POSE_LANDMARK.LEFT_HEEL, heel);
      set(POSE_LANDMARK.LEFT_FOOT_INDEX, footIndex);
      set(POSE_LANDMARK.LEFT_ELBOW, elbow);
      set(POSE_LANDMARK.LEFT_WRIST, wrist);
      set(POSE_LANDMARK.LEFT_INDEX, hand);
      set(POSE_LANDMARK.LEFT_PINKY, hand);
      set(POSE_LANDMARK.LEFT_THUMB, wrist);
    } else {
      set(POSE_LANDMARK.RIGHT_KNEE, knee);
      set(POSE_LANDMARK.RIGHT_ANKLE, ankle);
      set(POSE_LANDMARK.RIGHT_HEEL, heel);
      set(POSE_LANDMARK.RIGHT_FOOT_INDEX, footIndex);
      set(POSE_LANDMARK.RIGHT_ELBOW, elbow);
      set(POSE_LANDMARK.RIGHT_WRIST, wrist);
      set(POSE_LANDMARK.RIGHT_INDEX, hand);
      set(POSE_LANDMARK.RIGHT_PINKY, hand);
      set(POSE_LANDMARK.RIGHT_THUMB, wrist);
    }
  }

  // Head landmarks are approximate: no metric uses them, but the stick figure does.
  const headDirection = splay(sagittal(pose.trunkAngle + pose.headTilt), pose.trunkLateral);
  const headCentre = add(shoulderMid, scale(headDirection, p.head));
  const anterior = sagittal(pose.trunkAngle + 90);
  const nose = add(headCentre, scale(anterior, 0.08));
  set(POSE_LANDMARK.NOSE, nose);
  set(POSE_LANDMARK.MOUTH_LEFT, add(nose, scale(lateral, 0.03)));
  set(POSE_LANDMARK.MOUTH_RIGHT, add(nose, scale(lateral, -0.03)));
  const eyeBase = add(headCentre, scale(anterior, 0.06));
  set(POSE_LANDMARK.LEFT_EYE, add(eyeBase, scale(lateral, 0.035)));
  set(POSE_LANDMARK.LEFT_EYE_INNER, add(eyeBase, scale(lateral, 0.02)));
  set(POSE_LANDMARK.LEFT_EYE_OUTER, add(eyeBase, scale(lateral, 0.05)));
  set(POSE_LANDMARK.RIGHT_EYE, add(eyeBase, scale(lateral, -0.035)));
  set(POSE_LANDMARK.RIGHT_EYE_INNER, add(eyeBase, scale(lateral, -0.02)));
  set(POSE_LANDMARK.RIGHT_EYE_OUTER, add(eyeBase, scale(lateral, -0.05)));
  set(POSE_LANDMARK.LEFT_EAR, add(headCentre, scale(lateral, 0.07)));
  set(POSE_LANDMARK.RIGHT_EAR, add(headCentre, scale(lateral, -0.07)));

  const world = points.map((point) => applyPosture(point, posture));
  const hipMidWorld = applyPosture(hipMid, posture);
  return world.map((point) => subtract(point, hipMidWorld));
}

/** Landmark that is furthest from the camera in a side view, and therefore partly occluded. */
export function sideVisibility(
  index: number,
  view: 'side' | 'front',
  cameraSide: 'left' | 'right',
): number {
  if (view === 'front') return 0.96;
  const farSide = cameraSide === 'left' ? 'RIGHT' : 'LEFT';
  const name = Object.entries(POSE_LANDMARK).find(([, value]) => value === index)?.[0] ?? '';
  return name.startsWith(farSide) ? 0.62 : 0.95;
}

export function worldToLandmarks(points: readonly Vec3[], visibility: number[]): Landmark[] {
  return points.map((point, index) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    visibility: visibility[index] ?? 1,
  }));
}
