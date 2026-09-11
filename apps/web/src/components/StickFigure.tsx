/**
 * The stick figure.
 *
 * The signature element of Kinetrace, and the only thing the app ever shows of
 * the user's body, because pixels are never kept.
 *
 * The ground line is what makes it legible. Without it a supine or quadruped
 * pose reads as scaffolding: you cannot tell whether somebody is lying down or
 * standing up. It is derived from the pose rather than drawn on: the lowest
 * landmark is whatever is touching the floor, in every posture.
 */

import { useMemo, type JSX } from 'react';
import { POSE_LANDMARK, SKELETON_BONES, type Landmark } from '@kinetrace/engine';
import { useTranslation } from '../i18n/useTranslation.js';

export interface StickFigureProps {
  landmarks: readonly Landmark[];
  /** World landmarks have Y up; image landmarks have Y down. */
  space?: 'world' | 'image';
  /**
   * Which anatomical plane to draw world landmarks in. The sagittal plane is
   * what a side view camera sees and the only one a lying or quadruped pose is
   * legible in; the frontal plane is what a front view camera sees. Ignored for
   * image landmarks, which are already the camera's own view.
   */
  plane?: 'sagittal' | 'frontal';
  /** Which side of the subject the camera sits on, for the sagittal plane. */
  cameraSide?: 'left' | 'right';
  /** Landmark indices to highlight, usually the joint the exercise tracks. */
  highlight?: readonly number[];
  /** Minimum visibility for a landmark to be drawn. */
  minVisibility?: number;
  className?: string;
  /** Far mode uses heavier strokes so the figure reads across a room. */
  far?: boolean;
  stroke?: string;
  highlightStroke?: string;
  groundStroke?: string;
  /** Draw the ground line. Off for the silhouette guide, which has its own frame. */
  ground?: boolean;
  /** A second, dimmer figure drawn behind, for side by side comparison. */
  ghost?: readonly Landmark[];
  /** Dashes the outline, for the silhouette the user lines themselves up with. */
  dashed?: boolean;
}

interface Projected {
  x: number;
  y: number;
  visible: boolean;
}

const VIEW = 100;
/** Landmarks below this index are the face; the figure draws a head instead. */
const FIRST_BODY_LANDMARK = 11;

function project(
  landmarks: readonly Landmark[],
  space: 'world' | 'image',
  minVisibility: number,
  plane: 'sagittal' | 'frontal',
  cameraSide: 'left' | 'right',
): Projected[] {
  // World space is X to the subject's left, Y up, Z out of their chest, so the
  // frontal plane is (x, y) and the sagittal plane is (z, y). A camera on the
  // subject's left sees the sagittal plane mirrored.
  const sagittal = space === 'world' && plane === 'sagittal';
  const horizontalSign = sagittal && cameraSide === 'left' ? -1 : 1;
  const points = landmarks.map((landmark) => ({
    x: (sagittal ? landmark.z : landmark.x) * horizontalSign,
    y: space === 'world' ? -landmark.y : landmark.y,
    visible: landmark.visibility >= minVisibility,
  }));

  const visible = points.filter((point) => point.visible);
  const source = visible.length >= 4 ? visible : points;
  const minX = Math.min(...source.map((point) => point.x));
  const maxX = Math.max(...source.map((point) => point.x));
  const minY = Math.min(...source.map((point) => point.y));
  const maxY = Math.max(...source.map((point) => point.y));
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  // Leave room under the figure for the ground line.
  const scale = (VIEW * 0.8) / Math.max(width, height);
  const offsetX = (VIEW - width * scale) / 2;
  const offsetY = (VIEW - height * scale) / 2 - 3;

  return points.map((point) => ({
    x: (point.x - minX) * scale + offsetX,
    y: (point.y - minY) * scale + offsetY,
    visible: point.visible,
  }));
}

/**
 * Head position and size, from the ears when they are visible and the nose
 * otherwise. The radius comes from the torso rather than the stroke width, so
 * the head stays in proportion however close the subject is to the camera.
 */
function headCircle(
  points: Projected[],
  fallbackRadius: number,
): { x: number; y: number; r: number } | null {
  const leftEar = points[POSE_LANDMARK.LEFT_EAR];
  const rightEar = points[POSE_LANDMARK.RIGHT_EAR];
  const nose = points[POSE_LANDMARK.NOSE];
  const centre =
    leftEar?.visible && rightEar?.visible
      ? { x: (leftEar.x + rightEar.x) / 2, y: (leftEar.y + rightEar.y) / 2 }
      : nose?.visible
        ? { x: nose.x, y: nose.y }
        : null;
  if (!centre) return null;

  const shoulderMid = midpointOf(points, POSE_LANDMARK.LEFT_SHOULDER, POSE_LANDMARK.RIGHT_SHOULDER);
  const hipMid = midpointOf(points, POSE_LANDMARK.LEFT_HIP, POSE_LANDMARK.RIGHT_HIP);
  // An adult head is roughly a quarter of the shoulder-to-hip length across.
  const torso =
    shoulderMid && hipMid ? Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y) : 0;
  const radius = torso > 1 ? torso * 0.26 : fallbackRadius;
  return { ...centre, r: radius };
}

function midpointOf(
  points: Projected[],
  first: number,
  second: number,
): { x: number; y: number } | null {
  const a = points[first];
  const b = points[second];
  if (!a?.visible || !b?.visible) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function StickFigure({
  landmarks,
  space = 'world',
  plane = 'frontal',
  cameraSide = 'left',
  highlight = [],
  minVisibility = 0.35,
  className,
  far = false,
  stroke = 'currentColor',
  highlightStroke,
  groundStroke,
  ground = true,
  ghost,
  dashed = false,
}: StickFigureProps): JSX.Element {
  const { t } = useTranslation();
  const points = useMemo(
    () => project(landmarks, space, minVisibility, plane, cameraSide),
    [landmarks, space, minVisibility, plane, cameraSide],
  );
  const ghostPoints = useMemo(
    () => (ghost ? project(ghost, space, minVisibility, plane, cameraSide) : null),
    [ghost, space, minVisibility, plane, cameraSide],
  );
  const highlighted = useMemo(() => new Set(highlight), [highlight]);

  const width = far ? 3.6 : 2.8;
  const accent = highlightStroke ?? stroke;
  const head = headCircle(points, width * 2.3);

  /** The floor is wherever the lowest visible part of the body is. */
  const groundY = useMemo(() => {
    const visible = points.filter((point, index) => point.visible && index >= FIRST_BODY_LANDMARK);
    if (visible.length === 0) return null;
    return Math.max(...visible.map((point) => point.y)) + width * 1.4;
  }, [points, width]);

  const bones = (source: Projected[], colour: string, strokeWidth: number, opacity: number) =>
    SKELETON_BONES.map(([from, to]) => {
      const a = source[from];
      const b = source[to];
      if (!a || !b || !a.visible || !b.visible) return null;
      const isTracked = highlighted.has(from) && highlighted.has(to);
      return (
        <line
          key={`${from}-${to}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={isTracked ? accent : colour}
          strokeWidth={isTracked ? strokeWidth * 1.45 : strokeWidth}
          strokeLinecap="round"
          opacity={opacity}
          {...(dashed ? { strokeDasharray: `${strokeWidth * 1.3} ${strokeWidth * 1.1}` } : {})}
        />
      );
    });

  /** The neck: shoulders to the head, which the landmark topology has no bone for. */
  const neck = (() => {
    const left = points[POSE_LANDMARK.LEFT_SHOULDER];
    const right = points[POSE_LANDMARK.RIGHT_SHOULDER];
    if (!head || !left?.visible || !right?.visible) return null;
    return (
      <line
        x1={(left.x + right.x) / 2}
        y1={(left.y + right.y) / 2}
        x2={head.x}
        y2={head.y}
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
      />
    );
  })();

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={className}
      role="img"
      aria-label={t('a11y.skeleton')}
      preserveAspectRatio="xMidYMid meet"
    >
      {ground && groundY !== null ? (
        <line
          x1={4}
          y1={groundY}
          x2={VIEW - 4}
          y2={groundY}
          stroke={groundStroke ?? (far ? '#3a3733' : '#ddd5c9')}
          strokeWidth={width * 0.85}
          strokeLinecap="round"
        />
      ) : null}

      {ghostPoints ? bones(ghostPoints, stroke, width, 0.22) : null}
      {neck}
      {bones(points, stroke, width, 1)}

      {dashed
        ? null
        : points.map((point, index) =>
            point.visible && index >= FIRST_BODY_LANDMARK ? (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={highlighted.has(index) ? width * 0.95 : width * 0.6}
                fill={highlighted.has(index) ? accent : stroke}
              />
            ) : null,
          )}

      {head ? (
        <circle
          cx={head.x}
          cy={head.y}
          r={head.r}
          fill="none"
          stroke={stroke}
          strokeWidth={width}
          {...(dashed ? { strokeDasharray: `${width * 1.3} ${width * 1.1}` } : {})}
        />
      ) : null}
    </svg>
  );
}
