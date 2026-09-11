/**
 * The angle gauge.
 *
 * The key data visualisation of the session screen: being inside the target
 * band has to be readable from across the room, so the band is a thick arc in
 * the band colour and the current value is a heavy marker that changes colour
 * the moment it lands inside.
 */

import type { JSX } from 'react';
import type { TargetBand } from '@kinetrace/engine';

export interface AngleGaugeProps {
  /** Current value of the tracked metric, in degrees. */
  value: number;
  band: TargetBand;
  /** Range the gauge spans, in degrees. */
  min: number;
  max: number;
  /** Safety range; outside it the gauge turns to the safety colour. */
  safety?: TargetBand;
  /** Far mode uses heavier strokes and no small text. */
  far?: boolean;
  className?: string;
  label?: string;
}

const START_ANGLE = 150;
const SWEEP = 240;

function polar(cx: number, cy: number, radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

function arcPath(cx: number, cy: number, radius: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, radius, from);
  const [x2, y2] = polar(cx, cy, radius, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

export function AngleGauge({
  value,
  band,
  min,
  max,
  safety,
  far = false,
  className,
  label,
}: AngleGaugeProps): JSX.Element {
  const span = Math.max(max - min, 1);
  const toAngle = (input: number): number =>
    START_ANGLE + (Math.min(max, Math.max(min, input)) - min) * (SWEEP / span);

  const hasValue = Number.isFinite(value);
  const inBand = hasValue && value >= band.min && value <= band.max;
  const unsafe = hasValue && safety ? value < safety.min || value > safety.max : false;
  const markerColour = unsafe ? '#b3352a' : inBand ? '#2c7a58' : far ? '#f7f5f2' : '#1b1a18';

  const cx = 50;
  const cy = 50;
  const radius = 38;
  const track = far ? 11 : 8;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`${label ?? 'Angle'}: ${hasValue ? Math.round(value) : '—'}`}
    >
      <path
        d={arcPath(cx, cy, radius, START_ANGLE, START_ANGLE + SWEEP)}
        fill="none"
        stroke={far ? '#3a3833' : '#e3ded6'}
        strokeWidth={track}
        strokeLinecap="round"
      />
      <path
        d={arcPath(cx, cy, radius, toAngle(band.min), toAngle(band.max))}
        fill="none"
        stroke="#2c7a58"
        strokeWidth={track}
        strokeLinecap="butt"
        opacity={far ? 0.95 : 0.85}
      />
      {hasValue ? (
        <>
          <line
            {...(() => {
              const [x1, y1] = polar(cx, cy, radius - track, toAngle(value));
              const [x2, y2] = polar(cx, cy, radius + track * 0.9, toAngle(value));
              return { x1, y1, x2, y2 };
            })()}
            stroke={markerColour}
            strokeWidth={far ? 5 : 3.5}
            strokeLinecap="round"
          />
          <circle
            {...(() => {
              const [x, y] = polar(cx, cy, radius, toAngle(value));
              return { cx: x, cy: y };
            })()}
            r={far ? 5 : 3.5}
            fill={markerColour}
          />
        </>
      ) : null}
    </svg>
  );
}
