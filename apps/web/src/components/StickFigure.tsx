/**
 * The stick figure.
 *
 * The signature element of Kinetrace: consistent stroke, joints as dots, the
 * tracked joint highlighted. It reads at three metres, and it is all the app
 * ever shows of the user's body, because pixels are never kept.
 */

import type { JSX } from 'react';
import { useMemo } from 'react';
import { SKELETON_BONES, type Landmark } from '@kinetrace/engine';

export interface StickFigureProps {
  landmarks: readonly Landmark[];
  /** World landmarks have Y up; image landmarks have Y down. */
  space?: 'world' | 'image';
  /** Landmark indices to highlight, usually the joint the exercise tracks. */
  highlight?: readonly number[];
  /** Minimum visibility for a landmark to be drawn. */
  minVisibility?: number;
  className?: string;
  stroke?: string;
  highlightStroke?: string;
  strokeWidth?: number;
  /** A second, dimmer figure drawn behind, for side by side comparison. */
  ghost?: readonly Landmark[];
}

interface Projected {
  x: number;
  y: number;
  visible: boolean;
}

const VIEW = 100;

function project(
  landmarks: readonly Landmark[],
  space: 'world' | 'image',
  minVisibility: number,
): Projected[] {
  const points = landmarks.map((landmark) => ({
    x: landmark.x,
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
  const scale = (VIEW * 0.86) / Math.max(width, height);
  const offsetX = (VIEW - width * scale) / 2;
  const offsetY = (VIEW - height * scale) / 2;

  return points.map((point) => ({
    x: (point.x - minX) * scale + offsetX,
    y: (point.y - minY) * scale + offsetY,
    visible: point.visible,
  }));
}

export function StickFigure({
  landmarks,
  space = 'world',
  highlight = [],
  minVisibility = 0.35,
  className,
  stroke = 'currentColor',
  highlightStroke,
  strokeWidth = 2.6,
  ghost,
}: StickFigureProps): JSX.Element {
  const points = useMemo(
    () => project(landmarks, space, minVisibility),
    [landmarks, space, minVisibility],
  );
  const ghostPoints = useMemo(
    () => (ghost ? project(ghost, space, minVisibility) : null),
    [ghost, space, minVisibility],
  );
  const highlighted = useMemo(() => new Set(highlight), [highlight]);

  const bones = (source: Projected[], color: string, width: number, opacity: number) =>
    SKELETON_BONES.map(([from, to]) => {
      const a = source[from];
      const b = source[to];
      if (!a || !b || !a.visible || !b.visible) return null;
      const isHighlighted = highlighted.has(from) && highlighted.has(to);
      return (
        <line
          key={`${from}-${to}-${color}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={isHighlighted ? (highlightStroke ?? color) : color}
          strokeWidth={isHighlighted ? width * 1.5 : width}
          strokeLinecap="round"
          opacity={opacity}
        />
      );
    });

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={className}
      role="img"
      aria-label="Skeleton"
      preserveAspectRatio="xMidYMid meet"
    >
      {ghostPoints && bones(ghostPoints, stroke, strokeWidth, 0.25)}
      {bones(points, stroke, strokeWidth, 1)}
      {points.map((point, index) =>
        point.visible && index >= 11 ? (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={highlighted.has(index) ? strokeWidth * 1.5 : strokeWidth * 0.9}
            fill={highlighted.has(index) ? (highlightStroke ?? stroke) : stroke}
          />
        ) : null,
      )}
      {points[0]?.visible ? (
        <circle
          cx={points[0].x}
          cy={points[0].y}
          r={strokeWidth * 2.6}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : null}
    </svg>
  );
}
